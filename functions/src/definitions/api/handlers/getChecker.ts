import { Request, Response } from "express"
import { VoteSummary } from "../interfaces"
import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"

if (!admin.apps.length) {
    admin.initializeApp()
}

const db = admin.firestore()

const getCheckerHandler = async (req: Request, res: Response) => {
    const checkerId = req.params.checkerId;
    try {
        //IMPLEMENT
        let returnData: VoteSummary[]

        returnData = []

        res.status(200).send(returnData);
    } catch (error) {
        logger.error('Error fetching documents: ', error);
        res.status(500).send(error);
    }
};

export default getCheckerHandler;