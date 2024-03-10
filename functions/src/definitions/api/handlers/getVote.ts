import { Request, Response } from "express"
import { Vote } from "../interfaces"
import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"

const getVoteHandler = async (req: Request, res: Response) => {
    // get message ID and voteRequestId
    const messageId = req.params.messageId
    const voteRequestId = req.params.voteRequestId
    // check that both are passed
    if (!messageId || !voteRequestId) {
        return res.status(400).send("Message Id or vote request Id missing.")
    }
    const returnData: Vote = {
        type: "text", //TODO
        text: null, //TODO
        caption: null, //TODO
        storageBucketUrl: null, //TODO
        category: null, //TODO
        truthScore: null, //TODO
        isAssessed: false, //TODO
        finalStats: {
            responseCount: 0, //TODO
            scamCount: 0, //TODO
            illicitCount: 0, //TODO
            infoCount: 0, //TODO
            satireCount: 0, //TODO
            spamCount: 0, //TODO
            irrelevantCount: 0, //TODO
            legitimateCount: 0, //TODO
            truthScore: 0, //TODO
            primaryCategory: "info", //TODO
            rationalisation: null, //TODO
        },
    }
    return returnData
}

export default getVoteHandler