import { Request, Response } from "express";
import { Checker } from "../interfaces";
import { CheckerData } from "../../../types";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import {
  computeLast30DaysStats,
  computeProgramStats,
} from "../../common/statistics";

if (!admin.apps.length) {
  admin.initializeApp();
}

import Hashids from "hashids";
const salt = process.env.HASHIDS_SALT;
const hashids = new Hashids(salt);

const db = admin.firestore();

const getCheckerHandler = async (req: Request, res: Response) => {
  try {
    const checkerId = req.params.checkerId;
    if (!checkerId) {
      return res.status(400).send("Checker ID missing.");
    }

    const checkerRef = db.collection("checkers").doc(checkerId);
    const checkerSnap = await checkerRef.get();

    if (!checkerSnap.exists) {
      return res.status(404).send(`Checker with id ${checkerId} not found`);
    }

    const checkerData = checkerSnap.data() as CheckerData;

    if (!checkerData) {
      return res.status(500).send("Checker data not found");
    }

    const pendingVoteQuery = db
      .collectionGroup("voteRequests")
      .where("factCheckerDocRef", "==", checkerRef)
      .where("category", "==", null);
    const pendingVoteSnap = await pendingVoteQuery.count().get();
    const pendingVoteCount = pendingVoteSnap.data().count;

    let referralCode = null;
    if (checkerData.whatsappId) {
      try {
        referralCode = hashids.encode(checkerData.whatsappId);
      } catch (error) {
        logger.error("Error encoding referral code", error);
      }
    }

    const returnData: Checker = {
      name: checkerData.name,
      type: checkerData.type,
      isActive: checkerData.isActive,
      hasCompletedProgram: checkerData.programData.programEnd != null,
      tier: checkerData.tier,
      isAdmin: checkerData.isAdmin,
      isOnboardingComplete: checkerData.isOnboardingComplete,
      isOnProgram: checkerData.programData.isOnProgram ?? false,
      referralCode: referralCode,
      pendingVoteCount: pendingVoteCount,
      achievements: null,
      level: 0, // TODO: Check
      experience: 0, // TODO: Check
      certificateUrl: checkerData.certificateUrl ?? null, // Include certificateUrl in the response
    };

    if (checkerData.programData.isOnProgram) {
      try {
        const {
          numVotes,
          numReferrals,
          numReports,
          accuracy,
          isProgramCompleted,
        } = await computeProgramStats(checkerSnap);

        returnData.programStats = {
          numVotes: numVotes,
          numVotesTarget: checkerData.programData.numVotesTarget,
          numReferrals: numReferrals,
          numReferralTarget: checkerData.programData.numReferralTarget,
          numReports: numReports,
          numReportTarget: checkerData.programData.numReportTarget,
          accuracy: accuracy,
          accuracyTarget: checkerData.programData.accuracyTarget,
          isProgramCompleted: isProgramCompleted,
        };
      } catch {
        logger.error("Error fetching program stats");
        return res.status(500).send("Error fetching program stats");
      }
    }

    const { totalVoted, accuracyRate, averageResponseTime, peopleHelped } =
      await computeLast30DaysStats(checkerSnap);

    returnData.last30days = {
      totalVoted: totalVoted,
      accuracyRate: accuracyRate,
      averageResponseTime: averageResponseTime,
      peopleHelped: peopleHelped,
    };

    res.status(200).send(returnData);
  } catch (error) {
    logger.error("Error fetching checker", error);
    res.status(500).send("Error fetching checker");
  }
};

export default getCheckerHandler;
