import { Request, Response, NextFunction } from "express"
import * as crypto from "crypto"
import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
/* 
TODO TONGYING: Check this!
Notes: I haven't checked this yet, got chatGPT to generate this LOL
But the purpose is to authenticate the calls from the nextJS app
and ensure they are coming from the Telegram webapp and aren't spoofed.
*/

interface ExtendedRequest extends Request {
  user?: string
}

async function validateFirebaseIdToken(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
) {
  const authorizationHeader = req.headers.authorization || ""
  const components = authorizationHeader.split(" ")

  // Check if the header has the correct format "Bearer [token]"
  if (components.length !== 2 || components[0] !== "Bearer") {
    functions.logger.warn("Error while verifying Firebase ID token")
    res.status(401).send("Unauthorized")
    return
  }

  const idToken = components[1]

  try {
    const decodedIdToken = await admin.auth().verifyIdToken(idToken)
    const telegramId = decodedIdToken.uid
    req.user = telegramId
    next()
  } catch (error) {
    functions.logger.error("Error while verifying Firebase ID token:", error)
    res.status(403).send("Unauthorized")
  }
}

export { validateFirebaseIdToken }
