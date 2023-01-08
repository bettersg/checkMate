const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
admin.initializeApp();

const app = express();

app.get('/', async (req, res) => {
  // Grab the text parameter.
  const original = req.query.text;
  // Push the new message into Firestore using the Firebase Admin SDK.
  const writeResult = await admin.firestore().collection('demo_messages').add({ original: original });
  // Send back a message that we've successfully written the message
  res.json({ result: `Message with ID: ${writeResult.id} added.` });
});

// Take the text parameter passed to this HTTP endpoint and insert it into 
// Firestore under the path /messages/:documentId/original
exports.addMessage = functions
  .region('asia-southeast1')
  .https.onRequest(app);