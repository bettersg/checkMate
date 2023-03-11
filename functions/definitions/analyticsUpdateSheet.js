const functions = require('firebase-functions');
const process = require('process');
const {google} = require('googleapis');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
var fetch = require('node-fetch');

async function authorize() {
  client = new google.auth.GoogleAuth({
    keyFile: 'serviceAccountKey.json', // note: this file only exists on GCP Console
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return client;
}

async function getFirestoreData() {
  // initialize database
  initializeApp({
    credential: cert(require('./serviceAccountKey.json')) // note: this file only exists on GCP Console
  });
  const db = getFirestore();
  const date = new Date().toLocaleString('en-US', {timeZone: 'Singapore'})

  /**
   * CHECK FOR [USERS]
   */
  const dbRefUsers = db.collection('users');
  const registeredUserCountSnapshot = await dbRefUsers.count().get();
  const registeredUserCount = registeredUserCountSnapshot.data().count;

  let repeatUsers = 0;
  let activeUsersToday = 0;
  let activeUsersThisWeek = 0;

  (await dbRefUsers.get()).forEach((doc) => {
    if (doc.get('instanceCount') >= 1){
      repeatUsers += 1
    }

    const midnightToday = new Date().setHours(0,0,0,0);
    if (doc.get('lastSent') >= midnightToday) {
      activeUsersToday += 1
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).setHours(0,0,0,0)
    const lastSentDate = doc.get('lastSent');
    if (lastSentDate._seconds * 1000 >= sevenDaysAgo) {
      activeUsersThisWeek += 1
    }
  })

  /**
   * CHECK FOR [CHECKERS]
   */
  const dbRefCheckers = db.collection('factCheckers');
  const registeredCheckersSnapshot = await dbRefCheckers.count().get();
  const registeredCheckersCount = registeredCheckersSnapshot.data().count;

  let repeatCheckers = 0;

  (await dbRefCheckers.get()).forEach((doc) => {
    if (doc.get('numVoted') >= 1){
      repeatCheckers += 1
    }
  })

  const data = {
    registeredUserCount,
    repeatUsers,
    activeUsersToday,
    activeUsersThisWeek,
    registeredCheckersCount,
    repeatCheckers,
  }

  return { data, date }
}

async function updateSheet(data, date, auth) {
  const sheetsAPI = google.sheets({version: 'v4', auth});
  
  const sheetUpdateDataAndCell = [
    [date, "B2"],
    [data?.registeredUserCount, "E4"],
    [data?.repeatUsers, "E8"],
    [data?.activeUsersToday, "E12"],
    [data?.activeUsersThisWeek, "E16"],
    [data?.registeredCheckersCount, "H4"],  
    [data?.repeatCheckers, "H8"],
    [data?.['bit.ly/add-checkmate'], "E3"],
    [data?.['bit.ly/join-checkmates'], "H3"],
    [data?.['bit.ly/checkmate-privacy'], "J3"]
  ]

  sheetUpdateDataAndCell.map(([cellData, cellIndex]) => {
    sheetsAPI.spreadsheets.values.update({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: `main!${cellIndex}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[cellData]],
      }
    });
  })
}

async function getBitlyMetrics(token){
  const bitlink = ["bit.ly/join-checkmates", "bit.ly/add-checkmate", "bit.ly/checkmate-privacy"]
  let bitlyClickCount = {}

  for (const link of bitlink) {
    await fetch(`https://api-ssl.bitly.com/v4/bitlinks/${link}/clicks/summary?unit=month&units=1`, {
      headers: {
          'Authorization': `Bearer ${token}`
      }
    }).then(res => res.json())
      .then(json => {
      bitlyClickCount[link] = json.total_clicks;
    })
  }

  return bitlyClickCount;
}

exports.analyticsUpdateSheet = ((message, context) => {
  // message and context are unused, only used to trigger function run

  authorize().then(async (auth) => {
    const {data, date} = await getFirestoreData();
    const bitlyData = await getBitlyMetrics(process.env.BITLY_TOKEN); // note: this token only exists on GCP Console
    const allData = {...data, ...bitlyData}
    await updateSheet(allData, date, auth);
  })
  .catch(
    console.error
  );
})