const process = require('process');
const {google} = require('googleapis');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  client = new google.auth.GoogleAuth({
    keyFile: "serviceAccountKey.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return client;
}

async function getFirestoreData() {
  // initialize database
  initializeApp({
    credential: cert(require('../../serviceAccountKey.json'))
  });
  const db = getFirestore();

  // get current timestamp
  const time = new Date();
  const YYYY = time.getFullYear();
  const MM = time.getMonth()+1;
  const DD = time.getDate();
  const HH = time.getHours();
  const mm = time.getMinutes();
  const ss = time.getSeconds();
  const date = `${DD}/${MM}/${YYYY} ${HH}:${mm}:${ss}`

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

function updateSheet(data, date, auth) {
  const sheetsAPI = google.sheets({version: 'v4', auth});

  const sheetUpdateDataAndCell = [
    [date, "B2"],
    [data?.registeredUserCount, "E4"],
    [data?.repeatUsers, "E8"],
    [data?.activeUsersToday, "E12"],
    [data?.activeUsersThisWeek, "E16"],
    [data?.registeredCheckersCount, "H4"],  
    [data?.repeatCheckers, "H8"]
  ]

  sheetUpdateDataAndCell.map(([cellData, cellIndex]) => {
    sheetsAPI.spreadsheets.values.update({
      spreadsheetId: process.env.SPREADSHEET_ID || '1JOWHb2me-gFiPx5idT9ijUXpKCT-MGrLSVSPk4wZsi0',
      range: `main!${cellIndex}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[cellData]],
      }
    });
  })
}

exports.analyticsUpdateSheet = authorize()
  .then(async (auth) => {
    const {data, date} = await getFirestoreData();
    updateSheet(data, date, auth);
  })
  .catch(
    console.error
  );