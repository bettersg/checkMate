const functions = require("firebase-functions")

exports.healthcheck = functions
  .region("asia-southeast1")
  .https.onRequest((req, res) => {
    res.sendStatus(200)
  })
