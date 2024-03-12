import * as functions from "firebase-functions"
import { onRequest } from "firebase-functions/v2/https"

const healthcheckV2 = onRequest((req, res) => {
  res.sendStatus(200)
})

export { healthcheckV2 }
