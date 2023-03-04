
const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');
// const admin = require("firebase-admin");
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
// const TOKEN_PATH = path.join(process.cwd(), 'token.json');
// const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
// async function loadSavedCredentialsIfExist() {
//   try {
//     const content = await fs.readFile(TOKEN_PATH);
//     const credentials = JSON.parse(content);
//     return google.auth.fromJSON(credentials);
//   } catch (err) {
//     return null;
//   }
// }

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
// async function saveCredentials(client) {
//   const content = await fs.readFile(CREDENTIALS_PATH);
//   const keys = JSON.parse(content);
//   const key = keys.installed || keys.web;
//   const payload = JSON.stringify({
//     type: 'authorized_user',
//     client_id: key.client_id,
//     client_secret: key.client_secret,
//     refresh_token: client.credentials.refresh_token,
//   });
//   await fs.writeFile(TOKEN_PATH, payload);
// }

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  // let client = await loadSavedCredentialsIfExist();
  // if (client) {
  //   return client;
  // }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  // if (client.credentials) {
  //   await saveCredentials(client);
  // }
  return client;
}

async function getFirestoreData() {
  // initialize database
  initializeApp({
    credential: cert(require('../../adminKey.json'))
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

  // [database] get # total users
  const registeredUserCountSnapshot = await db.collection('users').count().get();
  const registeredUserCount = registeredUserCountSnapshot.data().count;

  // [LOOP COLLECTION TO CHECK]
  const dbRefUsers = db.collection('users');
  let repeatUsers = 0;
  let activeUsersToday = 0;
  let activeUsersThisWeek = 0;

  (await dbRefUsers.get()).forEach((doc) => {
    // [database] get # users that sent > 1 message
    if (doc.get('instanceCount') >= 1){
      repeatUsers += 1
    }

    // [database] get # users active today
    const midnightToday = new Date().setHours(0,0,0,0);
    if (doc.get('lastSent') >= midnightToday) {
      activeUsersToday += 1
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).setHours(0,0,0,0)
    const lastSentDate = doc.get('lastSent');
    // [database] get # users active this week
    if (lastSentDate._seconds * 1000 >= sevenDaysAgo) {
      activeUsersThisWeek += 1
    }
  })

  const data = {
    registeredUserCount,
    repeatUsers,
    activeUsersToday,
    activeUsersThisWeek,
  }

  return { data, date }
}

function updateSheet(data, date, auth) {
  const sheetsAPI = google.sheets({version: 'v4', auth});
  const {
    registeredUserCount,
    repeatUsers,
    activeUsersToday,
    activeUsersThisWeek,
  } = data

  sheetsAPI.spreadsheets.values.update({
    spreadsheetId: process.env.SPREADSHEET_ID || '1JOWHb2me-gFiPx5idT9ijUXpKCT-MGrLSVSPk4wZsi0',
    range: 'main!B2',
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[date]],
    }
  });

  sheetsAPI.spreadsheets.values.update({
    spreadsheetId: process.env.SPREADSHEET_ID || '1JOWHb2me-gFiPx5idT9ijUXpKCT-MGrLSVSPk4wZsi0',
    range: 'main!E4',
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[registeredUserCount]],
    }
  });

  sheetsAPI.spreadsheets.values.update({
    spreadsheetId: process.env.SPREADSHEET_ID || '1JOWHb2me-gFiPx5idT9ijUXpKCT-MGrLSVSPk4wZsi0',
    range: 'main!E8',
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[repeatUsers]],
    }
  });

  sheetsAPI.spreadsheets.values.update({
    spreadsheetId: process.env.SPREADSHEET_ID || '1JOWHb2me-gFiPx5idT9ijUXpKCT-MGrLSVSPk4wZsi0',
    range: 'main!E12',
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[activeUsersToday]],
    }
  });

  sheetsAPI.spreadsheets.values.update({
    spreadsheetId: process.env.SPREADSHEET_ID || '1JOWHb2me-gFiPx5idT9ijUXpKCT-MGrLSVSPk4wZsi0',
    range: 'main!E16',
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[activeUsersThisWeek]],
    }
  });
  return;
}

exports.analyticsUpdateSheet = authorize()
  .then(async (auth) => {
    const {data, date} = await getFirestoreData();
    updateSheet(data, date, auth);
  })
  .catch(
    console.error
  );