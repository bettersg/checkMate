const functions = require('firebase-functions')
const process = require('process')
const { google } = require('googleapis')
var fetch = require('node-fetch')
const admin = require('firebase-admin')

if (!admin.apps.length) {
  admin.initializeApp()
}

async function authorize() {
  const credential = admin.credential.applicationDefault()
  const client = await credential.getAccessToken()
  return client
}

async function getFirestoreData() {
  // initialize database
  const db = admin.firestore()
  const date = new Date().toLocaleString('en-US', { timeZone: 'Singapore' })

  /**
   * CHECK FOR [USERS]
   */
  const dbRefUsers = db.collection('users')
  const registeredUserCountSnapshot = await dbRefUsers.count().get()
  const registeredUserCount = registeredUserCountSnapshot.data().count

  let repeatUsers = 0
  let activeUsersToday = 0
  let activeUsersThisWeek = 0

  ;(await dbRefUsers.get()).forEach((doc) => {
    if (doc.get('instanceCount') >= 1) {
      repeatUsers += 1
    }

    const today = new Date()
    const lastSentDate = doc.get('lastSent')

    if (lastSentDate) {
      const oneDayAgo = subtractHours(today, 24)
      if (lastSentDate.toDate() >= oneDayAgo) {
        activeUsersToday += 1
      }

      const sevenDaysAgo = subtractHours(today, 24 * 7)
      if (lastSentDate.toDate() >= sevenDaysAgo) {
        activeUsersThisWeek += 1
      }
    }
  })

  /**
   * CHECK FOR [CHECKERS]
   */
  const dbRefCheckers = db.collection('factCheckers')
  const registeredCheckersSnapshot = await dbRefCheckers.count().get()
  const registeredCheckersCount = registeredCheckersSnapshot.data().count

  let repeatCheckers = 0
  let individualCheckersData = {}
  const dbSnapCheckers = await dbRefCheckers.get()
  for (const doc of dbSnapCheckers.docs) {
    const factCheckerId = doc.id
    const outstandingVoteRequestsQuerySnap = await db
      .collectionGroup('voteRequests')
      .where('platformId', '==', factCheckerId)
      .where('category', '==', null)
      .get()
    const totalSentVoteRequestsQuerySnap = await db
      .collectionGroup('voteRequests')
      .where('platformId', '==', factCheckerId)
      .get()
    const totalSentVoteRequests = totalSentVoteRequestsQuerySnap.size
    const outstandingVoteRequests = outstandingVoteRequestsQuerySnap.size
    individualCheckersData[factCheckerId] = {
      A: factCheckerId, //id
      B: totalSentVoteRequests, //total votes sent
      C: totalSentVoteRequests - outstandingVoteRequests, //total voted on
      D: 1 - outstandingVoteRequests / totalSentVoteRequests, //completion rate
    }
  }
  const data = {
    registeredUserCount,
    repeatUsers,
    activeUsersToday,
    activeUsersThisWeek,
    registeredCheckersCount,
    repeatCheckers,
    individualCheckersData,
  }

  return { data, date }
}

async function updateSheet(data, date, auth) {
  const sheetsAPI = google.sheets({ version: 'v4', auth: null })
  const headers = { Authorization: `Bearer ${auth.access_token}` }

  const sheetUpdateDataAndCell = [
    [date, 'B2'],
    [data?.registeredUserCount, 'E4'],
    [data?.repeatUsers, 'E8'],
    [data?.activeUsersToday, 'E12'],
    [data?.activeUsersThisWeek, 'E16'],
    [data?.registeredCheckersCount, 'H4'],
    [data?.repeatCheckers, 'H8'],
    [data?.['bit.ly/add-checkmate'], 'E3'],
    [data?.['bit.ly/join-checkmates'], 'H3'],
    [data?.['bit.ly/checkmate-privacy'], 'J3'],
  ]
  // Add the individual checkers data
  let checkersHeadersRow = 25
  for (const [factCheckerId, factCheckerData] of Object.entries(
    data?.individualCheckersData ?? {}
  )) {
    checkersHeadersRow += 1
    for (const [key, value] of Object.entries(factCheckerData)) {
      sheetUpdateDataAndCell.push([value, `${key}${checkersHeadersRow}`])
    }
  }

  functions.logger.log(sheetUpdateDataAndCell)

  // Prepare the batch update request
  const updateRequests = sheetUpdateDataAndCell.map(([cellData, cellIndex]) => {
    return {
      updateCells: {
        range: {
          sheetId: 0, // Assuming the first sheet
          startRowIndex: cellIndex.slice(1) - 1,
          endRowIndex: cellIndex.slice(1),
          startColumnIndex: cellIndex.charCodeAt(0) - 65,
          endColumnIndex: cellIndex.charCodeAt(0) - 64,
        },
        rows: [
          {
            values: [
              {
                userEnteredValue: {
                  stringValue: cellData.toString(),
                },
              },
            ],
          },
        ],
        fields: 'userEnteredValue',
      },
    }
  })

  const batchUpdateRequest = {
    spreadsheetId: process.env.SPREADSHEET_ID,
    resource: {
      requests: updateRequests,
    },
    headers,
  }

  // Perform the batch update
  await sheetsAPI.spreadsheets.batchUpdate(batchUpdateRequest)
}

async function getBitlyMetrics(token) {
  const bitlink = [
    'bit.ly/join-checkmates',
    'bit.ly/add-checkmate',
    'bit.ly/checkmate-privacy',
  ]
  let bitlyClickCount = {}

  for (const link of bitlink) {
    await fetch(
      `https://api-ssl.bitly.com/v4/bitlinks/${link}/clicks/summary?unit=month&units=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )
      .then((res) => res.json())
      .then((json) => {
        bitlyClickCount[link] = json.total_clicks
      })
  }

  return bitlyClickCount
}

function subtractHours(date, hours) {
  date.setHours(date.getHours() - hours)
  return date
}

exports.analyticsUpdateSheet = functions
  .region('asia-southeast1')
  .runWith({ secrets: ['BITLY_TOKEN'] })
  .pubsub.topic('analytics-google-sheets-api')
  .onPublish(async (message) => {
    // message and context are unused, only used to trigger function run
    await authorize()
      .then(async (auth) => {
        const { data, date } = await getFirestoreData()
        const bitlyData = await getBitlyMetrics(process.env.BITLY_TOKEN)
        const allData = { ...data, ...bitlyData }
        await updateSheet(allData, date, auth)
      })
      .catch(functions.logger.error)
  })
