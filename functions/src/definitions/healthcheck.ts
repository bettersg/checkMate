import * as functions from "firebase-functions"

const healthcheck = functions
  .region("asia-southeast1")
  .https.onRequest((req, res) => {
    res.sendStatus(200)
  })

export { healthcheck }
