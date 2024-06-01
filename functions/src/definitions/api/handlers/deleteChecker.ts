import { Request, Response } from "express"
import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

const deleteCheckerHandler = async (req: Request, res: Response) => {
  try {
    const checkerId = req.params.checkerId
    //TODO: GET RETURN FIELDS FROM FIRESTORE
    if (!checkerId) {
      return res.status(400).send("Checker ID missing.")
    }

    const checkerRef = db.collection("checkers").doc(checkerId)
    const checkerSnap = await checkerRef.get()

    if (!checkerSnap.exists) {
      return res.status(404).send(`Checker with id ${checkerId} not found`)
    }

    await checkerRef.delete()
    await admin.auth().deleteUser(checkerId)

    res.status(200).send()
  } catch (error) {
    logger.error("Error getting checker", error)
    res.status(500).send("Error getting checker")
  }
}

export default deleteCheckerHandler
