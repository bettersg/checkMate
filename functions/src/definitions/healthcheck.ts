import * as functions from "firebase-functions"
import { FirebaseRequest, FirebaseResponse } from "../types"

export const healthcheck = functions
  .region("asia-southeast1")
  .https.onRequest((req: FirebaseRequest, res: FirebaseResponse) => {
    res.sendStatus(200)
  })
