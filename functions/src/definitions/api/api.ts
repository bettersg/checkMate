import * as admin from "firebase-admin"
import express from "express"
import * as functions from "firebase-functions"
import { validateFirebaseIdToken } from "./middleware/validator"
import { onRequest } from "firebase-functions/v2/https"
import { Timestamp } from 'firebase-admin/firestore';
import { TeleMessage, VoteRequest } from "../../types";
import { getCount } from "../common/counters"
import { config } from 'dotenv';

config();

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const app = express()
// app.use(validateFirebaseIdToken) //TODO: uncomment if you want to turn off validation

const testFetch = async () => {
  try {
    const snapshot = await db.collection("messages").get();

    snapshot.forEach((doc) => {
      functions.logger.log(doc.id, "=>", doc.data())
    })
    return snapshot
  } catch (err) {
    functions.logger.log(err)
  }
}

const stringToTimestamp = (dateString: string) => {
  const date = new Date(dateString)
  return Timestamp.fromDate(date)
}

app.get("/helloworld", async (req, res) => {
  const snapshot = await testFetch()
  if (snapshot && !snapshot.empty) {
    functions.logger.log("success");
  }
  res.send("Hello World!")
})

// Helper function for testing environment to add voteRequests to all messages
app.post("/addVoteRequest", async (req, res) => {
  try {
    const { phoneNumber, platformId, ...data } = req.body;

    if (!phoneNumber || !platformId) {
      res.status(400).json({ success: false, error: "Missing phoneNumber or platformId" });
      return;
    }

    // Use the current time as the createdTimestamp
    const timestampDate = new Date();
    // Convert the Date object into a Firestore Timestamp
    const timestamp = Timestamp.fromDate(timestampDate);

    // Get the factCheckers document reference from the database
    const factCheckerRef = db.doc(`factCheckers/${phoneNumber}`);

    // Get all messages from the messages collection
    const messages = await db.collection('messages').get();

    // Add a new voteRequest to each message
    const promises = messages.docs.map(messageDoc => {
      const voteRequestRef = messageDoc.ref.collection('voteRequests').doc();
      return voteRequestRef.set({
        acceptedTimestamp: null,
        category: null,
        createdTimestamp: timestamp,
        factCheckerDocRef: factCheckerRef,
        hasAgreed: false,
        platform: 'telegram',
        platformId: platformId,
        sentMessageId: null,
        triggerL2Others: null,
        triggerL2Vote: null,
        vote: null,
        votedTimestamp: null
      });
    });

    // Wait for all the voteRequests to be added
    await Promise.all(promises);

    res.status(200).json({ success: true, message: "Vote requests added successfully" });
  } catch (error) {
    functions.logger.error("Error adding document: ", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

//function that fetches all messages for the checker
const fetchMessagesByUserPhone = async (phoneNo: string) => {
  try {
    //find all the voteRequests sent to user
    const factCheckerRef = db.doc(`factCheckers/${phoneNo}`);
    functions.logger.log(`Fetch messages by user phone: ${phoneNo}`);

    const voteRequestsSnapshot = await db
      .collectionGroup("voteRequests")
      .where("factCheckerDocRef", "==", factCheckerRef)
      .get();

    //find the corresponding messages doc id
    const documentIds: string[] = [];
    voteRequestsSnapshot.forEach((doc) => {
      const parentId = doc.ref.parent?.parent?.id;
      if (parentId) {
        documentIds.push(parentId)
      }
    });

    const messagesQuery = await db.getAll(
      ...documentIds.map((documentId) => db.collection("messages").doc(documentId))
    );

    //convert each messages doc into Message object
    let messagesData: TeleMessage[] = [];

    await Promise.all(messagesQuery.map(async (doc) => {
      const data = doc.data();
      if (data) {
        // Fetch the specific document from the voteRequests subcollection
        const voteRequestDocRef = await doc.ref.collection("voteRequests")
          .where("factCheckerDocRef", "==", factCheckerRef)
          .limit(1)
          .get();

        const voteRequestData = voteRequestDocRef.docs[0]?.data();

        // Fetch the latest instance document for image url
        const latestInstanceRef = data.latestInstance;
        const latestInstanceDoc = await latestInstanceRef?.get();
        const latestInstanceData = latestInstanceDoc?.data();
        const storageUrl = latestInstanceData?.storageUrl || null;
        let temporaryUrl = null;

        if (process.env.ENVIRONMENT !== "PROD") {
          temporaryUrl = process.env.TEST_IMAGE_URL;;
        }
        else {
          try {
            const storage = admin.storage();
            [temporaryUrl] = await storage
              .bucket()
              .file(storageUrl)
              .getSignedUrl({
                action: "read",
                expires: Date.now() + 60 * 60 * 1000,
              });
          } catch (error) {
            functions.logger.error(error)
          }
        }

        let isMatch = false;
        if (voteRequestData) {
          isMatch = data.primaryCategory === voteRequestData.category;

          if (data.primaryCategory === "info" || data.primaryCategory === "misleading" || data.primaryCategory === "untrue" || data.primaryCategory === "accurate") {
            if (voteRequestData.category === "info") {
              if (voteRequestData.truthScore - data.truthScore < 1 && voteRequestData.truthScore - data.truthScore > -1) {
                isMatch = true;
              }
            }
          }
        }

        //calculate voting percentages
        const messageRef = doc.ref;
        const responseCount = await getCount(messageRef, "responses");
        functions.logger.log("responseCount: ", responseCount);
        let crowdCount = 0;
        let votedCount = 0;

        if (data.primaryCategory === "untrue" || data.primaryCategory === "misleading" || data.primaryCategory === "accurate") {
          crowdCount = await getCount(messageRef, "info")
        }
        else {
          crowdCount = await getCount(messageRef, `${data.primaryCategory}`)
        }
        functions.logger.log("crowdCount: ", crowdCount);
        const crowdPercentage = crowdCount > 0 ? Number((crowdCount / responseCount * 100).toFixed(2)) : 0;
        if (isMatch) {
          votedCount = crowdCount;
        }
        else {
          if (data.primaryCategory === "untrue" || data.primaryCategory === "misleading" || data.primaryCategory === "accurate") {
            votedCount = await getCount(messageRef, "info")
          }
          else {
            votedCount = await getCount(messageRef, `${voteRequestData.category}`)
          }
        }
        const votedPercentage = votedCount > 0 ? Number((votedCount / responseCount * 100).toFixed(2)) : 0;

        const message: TeleMessage = {
          id: doc.id,
          text: data.text || "",
          caption: data.caption || null,
          isAssessed: data.isAssessed || false,
          isMatch: isMatch,
          primaryCategory: data.primaryCategory || null,
          voteRequests: {
            id: voteRequestDocRef.docs[0]?.id,
            factCheckerDocRef: voteRequestData.factCheckerDocRef || null,
            category: voteRequestData?.category || null,
            createdTimestamp: voteRequestData.createdTimestamp ? voteRequestData.createdTimestamp.toDate().toISOString() : null,
            acceptedTimestamp: voteRequestData?.acceptedTimestamp ? voteRequestData.acceptedTimestamp.toDate().toISOString() : null,
            hasAgreed: voteRequestData?.hasAgreed || false,
            vote: voteRequestData?.vote || null,
            votedTimestamp: voteRequestData?.votedTimestamp ? voteRequestData.votedTimestamp.toDate().toISOString() : null,
            checkTimestamp: voteRequestData?.checkTimestamp ? voteRequestData.checkTimestamp.toDate().toISOString() : null,
            truthScore: voteRequestData?.truthScore || null,
            isView: (data.isAssessed && voteRequestData.checkTimestamp && voteRequestData.category) || (!data.isAssessed && voteRequestData.acceptedTimestamp && voteRequestData.hasAgreed) ? true : false,
          },
          rationalisation: data.rationalisation || null,
          avgTruthScore: data.truthScore || null,
          firstTimestamp: data.firstTimestamp.toDate().toISOString() || new Date().toISOString(),
          storageUrl: temporaryUrl || null,
          crowdPercentage: crowdPercentage,
          votedPercentage: votedPercentage,
          //isView is true if the checker has read msg before

        };
        //print to see what the message obj looks like
        functions.logger.log(message);
        messagesData.push(message);
      }
    }));


    // functions.logger.log(messagesData);
    return messagesData;
  } catch (err) {
    functions.logger.log(err);
    return [];
  }
};

//get all of checker's messages for myVotes page
app.get("/checkers/:phoneNo/messages", async (req, res) => {
  const phoneNo = req.params.phoneNo;
  // functions.logger.log(`Calling /api/getVotes with: ${phoneNo}`);
  const messages = await fetchMessagesByUserPhone(phoneNo);
  if (messages.length === 0) {
    functions.logger.log("No messages found");
  }
  return res.json({ messages: messages })
})

//update if checker has checked vote result
app.patch("/checkers/:phoneNo/messages/:msgId/voteResult", async (req, res) => {

  const phoneNo = req.params.phoneNo;
  const msgId = req.params.msgId;
  try {
    const messageDoc = await db.collection('messages').doc(msgId).get();

    if (!messageDoc.exists) {
      res.status(404).json({ error: 'Message not found' });
    }

    const factCheckerRef = db.doc(`factCheckers/${phoneNo}`);

    const data = messageDoc.data();
    if (data) {
      // Access the VoteRequests subcollection
      const voteRequestsCollection = messageDoc.ref.collection('voteRequests');

      // Query to get the specific VoteRequest document by checker
      const voteRequestQuery = await voteRequestsCollection
        .where('factCheckerDocRef', '==', factCheckerRef)
        .get();

      if (voteRequestQuery.docs.length === 0) {
        return res.status(404).json({ error: 'VoteRequest not found' });
      } else {
        const voteRequestDoc = voteRequestQuery.docs[0];
        const voteRequestData = voteRequestDoc.data();
        // functions.logger.log('Existing data:', voteRequestData);

        // Update the hasAgreed and acceptedTimestamp if its first time viewing file (not voted)
        if (data.isAssessed && voteRequestData.checkTimestamp == null && voteRequestData.category != null) {
          await voteRequestDoc.ref.update({
            checkTimestamp: Timestamp.fromDate(new Date()),
          });
        }
        //retrieve updated voteRequest from firebase
        const updatedVoteRequestDoc = await voteRequestDoc.ref.get();
        const updatedVoteRequestData = updatedVoteRequestDoc.data();

        const voteReq: VoteRequest = {
          id: updatedVoteRequestDoc.ref.id,
          factCheckerDocRef: updatedVoteRequestData?.factCheckerDocRef || null,
          category: updatedVoteRequestData?.category || null,
          createdTimestamp: updatedVoteRequestData?.createdTimestamp,
          acceptedTimestamp: updatedVoteRequestData?.acceptedTimestamp || null,
          hasAgreed: updatedVoteRequestData?.hasAgreed || false,
          vote: updatedVoteRequestData?.vote || null,
          votedTimestamp: updatedVoteRequestData?.votedTimestamp || null,
          checkTimestamp: updatedVoteRequestData?.checkTimestamp || null,
          truthScore: updatedVoteRequestData?.truthScore || null,
          isView: (data.isAssessed && updatedVoteRequestData?.checkTimestamp && updatedVoteRequestData.category) || (!data.isAssessed && updatedVoteRequestData?.acceptedTimestamp && updatedVoteRequestData.hasAgreed) ? true : false,
        };
        // functions.logger.log('Updated data:', voteReq);
        res.status(200).json({ success: true, voteRequest: voteReq });
        return;
      }
    }

  } catch (error) {
    functions.logger.error('Error fetching message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
})

//update user vote for a message - /vote/:voteId
app.patch("/checkers/:phoneNo/messages/:msgId/voteRequest", async (req, res) => {
  const vote = req.body.vote;
  const truthScore = req.body.truthScore;
  const msgId = req.params.msgId;
  const phoneNo = req.params.phoneNo;

  try {
    // Reference to the message document
    const messageRef = db.collection('messages').doc(msgId);
    const messageDoc = await messageRef.get();
    const data = messageDoc.data();

    // Reference to the VoteRequests subcollection
    const voteRequestsCollection = messageRef.collection('voteRequests');
    const factCheckerRef = db.doc(`factCheckers/${phoneNo}`);

    // Query to get the specific VoteRequest document by checker
    const voteRequestQuery = await voteRequestsCollection
      .where("factCheckerDocRef", "==", factCheckerRef)
      .get();

    if (voteRequestQuery.empty) {
      res.status(404).json({ error: 'VoteRequest not found' });
    } else {

      // Assuming there's only one matching document, you can retrieve it
      const voteRequestDoc = voteRequestQuery.docs[0];
      if (!voteRequestDoc) {
        res.status(404).json({ error: 'VoteRequest document not found' });
      } else {
        // functions.logger.log('Existing data:', voteRequestDoc.data());
        //update isView after first vote
        if (voteRequestDoc.data()?.hasAgreed == false && !voteRequestDoc.data()?.acceptedTimestamp) {
          await voteRequestDoc.ref.update({
            hasAgreed: true,
            acceptedTimestamp: Timestamp.fromDate(new Date()),
          });
        }
        // Update the document
        await voteRequestDoc.ref.update({
          category: vote,
          votedTimestamp: Timestamp.fromDate(new Date()),
          vote: truthScore, //otherwise onVoteRequestUpdate won't work...TO REVIEW
          truthScore: truthScore,
        });

        //retrieve updated voteRequest from firebase
        const updatedVoteRequestDoc = await voteRequestDoc.ref.get();
        const updatedVoteRequestData = updatedVoteRequestDoc.data();

        const voteReq: VoteRequest = {
          id: updatedVoteRequestDoc.ref.id,
          factCheckerDocRef: updatedVoteRequestData?.factCheckerDocRef || null,
          category: updatedVoteRequestData?.category || null,
          createdTimestamp: updatedVoteRequestData?.createdTimestamp,
          acceptedTimestamp: updatedVoteRequestData?.acceptedTimestamp || null,
          hasAgreed: updatedVoteRequestData?.hasAgreed || false,
          vote: updatedVoteRequestData?.vote || null,
          votedTimestamp: updatedVoteRequestData?.votedTimestamp || null,
          checkTimestamp: updatedVoteRequestData?.checkTimestamp || null,
          truthScore: updatedVoteRequestData?.truthScore || null,
          isView: (data?.isAssessed && updatedVoteRequestData?.checkTimestamp && updatedVoteRequestData.category) || (!data?.isAssessed && updatedVoteRequestData?.acceptedTimestamp && updatedVoteRequestData.hasAgreed) ? true : false,
        };
        // functions.logger.log('Updated data:', voteReq);
        res.status(200).json({ success: true, voteRequest: voteReq });
      }
    }

  } catch (error) {
    functions.logger.error('Error updating vote request:', error);
    res.sendStatus(500);
  }

})

// TODO: BRENNAN: Complete implementation for not found
app.get("/checkerData/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const factChecker = await db.collection("factCheckers").doc(id).get()
    const data = factChecker.data()
    console.log(data)
    res.status(200).json({ success: true, data })
  } catch (err) {
    functions.logger.log(err)
    res.status(500)
  }
})

app.put("/checkerData/:id", async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  // console.log(`HERE ID: ${id}`)
  // console.log(`REQUEST BODY: ${JSON.stringify(req.body)}`)

  try {
    await db.collection("factCheckers").doc(id).set(data)
    res.status(200).json({ success: true })
  } catch (err) {
    functions.logger.log(err)
    res.status(500)
  }
})

//TODO TONGYING: decide other routes and implement

const main = express()
main.use("/api", app)

const apiHandler = onRequest(
  {
    secrets: ["TELEGRAM_CHECKER_BOT_TOKEN"],
  },
  main
)

export { apiHandler }
