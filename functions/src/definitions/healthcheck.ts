import * as functions from "firebase-functions"

/**
 * Performs a healthcheck for the Firebase function.
 * This function sends a status code 200 if the service is healthy.
 * 
 * @returns { void } - Status code 200 if service is healthy
 */
const healthcheck = functions
  .region("asia-southeast1")
  .https.onRequest((req, res) => {
    res.sendStatus(200)
  })

export { healthcheck }
