import { Request, Response } from "express"
import { Checker } from "../interfaces"
import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"

if (!admin.apps.length) {
    admin.initializeApp()
}

const db = admin.firestore()

const getCheckerVotesHandler = async (req: Request, res: Response) => {
    const checkerId = req.params.checkerId
    //TODO: GET RETURN FIELDS FROM FIRESTORE
    const returnData: Checker = {
        name: "", //TODO
        type: "human", //TODO
        isActive: false, //TODO
        pendingVoteCount: 0, //TODO
        last30days: {
            totalVoted: 0, //TODO
            accuracyRate: 0, //TODO
            averageResponseTime: 0, //TODO
            peopleHelped: 0, //TODO
        },
        achievements: null,
        level: 0, //TODO,
        experience: 0, //TOD0
    }
    res.status(200).send(returnData)
}

export default getCheckerVotesHandler