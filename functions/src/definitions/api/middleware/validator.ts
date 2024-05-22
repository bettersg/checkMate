import { Request, Response, NextFunction } from "express"
import * as admin from "firebase-admin"
import * as functions from "firebase-functions"

const env = process.env.ENVIRONMENT

if (!admin.apps.length) {
  admin.initializeApp()
}
/* 
TODO TONGYING: Check this!
Notes: I haven't checked this yet, got chatGPT to generate this LOL
But the purpose is to authenticate the calls from the nextJS app
and ensure they are coming from the Telegram webapp and aren't spoofed.
*/

const db = admin.firestore()

async function validateFirebaseIdToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authorizationHeader = req.headers.authorization || ""
  //go next in development
  if (!authorizationHeader && env === "DEV") {
    next()
    return
  }
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
    const isAdmin = decodedIdToken.isAdmin
    const tier = decodedIdToken.tier
    const checkerID = decodedIdToken.uid
    if (!checkerID) {
      functions.logger.warn("Error while verifying Firebase ID token")
      return res.status(403).send("Unauthorized")
    }
    const checkerRef = db.collection("checkers").doc(checkerID)
    const checkerSnap = await checkerRef.get()
    if (!checkerSnap.exists) {
      functions.logger.warn("User not yet a checker")
      return res.status(403).send("Not an existing checker")
    }
    if (req.params.messageId && req.params.voteRequestId) {
      const voteRequestRef = db
        .collection("messages")
        .doc(req.params.messageId)
        .collection("voteRequests")
        .doc(req.params.voteRequestId)
      const voteRequestSnap = await voteRequestRef.get()
      if (!voteRequestSnap.exists) {
        functions.logger.warn("Vote request not found")
        return res.status(404).send("Vote request not found")
      }
      if (voteRequestSnap.get("factCheckerDocRef").id !== checkerID) {
        functions.logger.warn(
          "Unauthorized, checker ID does not match vote request"
        )
        return res
          .status(403)
          .send("Unauthorized, checker ID does not match vote request")
      }
    } else if (req.params.checkerId && req.params.checkerId !== checkerID) {
      functions.logger.warn("Unauthorized, checker ID does not match")
      return res.status(403).send("Unauthorized, checker ID does not match")
    }
    res.locals.checker = {
      id: checkerID,
      isAdmin: isAdmin,
      tier: tier,
    }
    next()
  } catch (error) {
    functions.logger.error("Error while verifying Firebase ID token:", error)
    return res.status(403).send("Unauthorized")
  }
}

export { validateFirebaseIdToken }
