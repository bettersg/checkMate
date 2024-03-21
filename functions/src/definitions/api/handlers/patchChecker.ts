import { Request, Response } from "express"
import { Checker } from "../../../types"
import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

const patchCheckerHandler = async (req: Request, res: Response) => {
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

    //check keys in request body, make sure they are defined in checker type
    const body = req.body
    const keys = Object.keys(body)
    const checker = checkerSnap.data() as Checker
    const checkerKeys = Object.keys(checker)
    const validKeys = keys.every((key) => checkerKeys.includes(key))

    if (!validKeys) {
      return res.status(400).send("Invalid keys in request body")
    }

    if ("whatsappId" in keys) {
      return res.status(400).send("whatsappId cannot be updated")
    }

    if ("telegramId" in keys) {
      return res.status(400).send("telegramId cannot be updated")
    }

    //update checker
    await checkerRef.update(body)

    const updatedCheckerSnap = await checkerRef.get()
    const updatedChecker = updatedCheckerSnap.data() as Checker

    res.status(200).send(updatedChecker)
  } catch (error) {
    logger.error("Error getting checker", error)
    res.status(500).send("Error getting checker")
  }
}

export default patchCheckerHandler
