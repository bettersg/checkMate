import * as admin from "firebase-admin"
import express from "express"
import { validateFirebaseIdToken } from "./middleware/validator"
import { onRequest } from "firebase-functions/v2/https"
// import { Timestamp, collectionGroup, query, where, serverTimestamp } from "firebase/firestore";
import { Timestamp } from 'firebase-admin/firestore';
import { DocumentReference } from '@google-cloud/firestore';
import { TeleMessage, VoteRequest } from "../../types";

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
      console.log(doc.id, "=>", doc.data())
    })
    return snapshot
  } catch (err) {
    console.log(err)
  }
}

const stringToTimestamp = (dateString: string) => {
  const date = new Date(dateString)
  return Timestamp.fromDate(date)
}

app.get("/helloworld", async (req, res) => {
  const snapshot = await testFetch()
  if (snapshot && !snapshot.empty) {
    console.log("success");
  }
  res.send("Hello World!")
})

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
    console.error("Error adding document: ", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

app.post("/addMessage", async (req, res) => {
  // Assume we already have the data parsed
  try {
    const { instances, ...data } = req.body; // Get the instances data from the request body
    const { replyTimestamp, timestamp, ...instancesData } = instances; // Get the instances data from the request body
    const { assessedTimestamp, assessmentExpiry, firstTimestamp, lastRefreshedTimestamp, lastTimestamp, ...messageData } = data; // Get the message data from the request body
    const docRef = await db.collection("message").doc();

    // Set the instances data fields
    const instancesRef = await docRef.collection("instances").doc();
    await instancesRef.set({...instancesData, 
      replyTimestamp: stringToTimestamp(replyTimestamp), 
      timestamp: stringToTimestamp(timestamp)
    })

    await docRef.set({...messageData, 
      latestInstance: instancesRef, 
      assessedTimestamp: stringToTimestamp(assessedTimestamp), 
      assessmentExpiry: stringToTimestamp(assessmentExpiry), 
      firstTimestamp: stringToTimestamp(firstTimestamp), 
      lastRefreshedTimestamp: stringToTimestamp(lastRefreshedTimestamp), 
      lastTimestamp: stringToTimestamp(lastTimestamp)
    });

    const messageIdRef = await db.collection("messageIds").doc();
    await messageIdRef.set({ instanceRef: instancesRef });

    res.status(200).json({ success: true, docId: docRef.id, instancesId: instancesRef.id, messageId: messageIdRef.id });
  } catch (error) {
    console.error("Error adding document: ", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
})

app.post("/addFactCheckers", async (req, res) => {
  try {
    const { phoneNumber, lastVotedTimestamp, ...data } = req.body;

    if (!phoneNumber || !lastVotedTimestamp) {
      res.status(400).json({ success: false, error: "Missing phoneNumber or lastVotedTimestamp" });
      return;
    }

    // Parse the lastVotedTimestamp from the request body into a Date object
    const timestampDate = new Date(lastVotedTimestamp);
    // Convert the Date object into a Firestore Timestamp
    const timestamp = Timestamp.fromDate(timestampDate);

    const docRef = await db.collection("factCheckers").doc(phoneNumber);

    // Set the Firestore Timestamp as the value of the "lastVotedTimestamp" field
    await docRef.set({ ...data, lastVotedTimestamp: timestamp });

    res.status(200).json({ success: true, id: docRef.id });
  } catch (error) {
    console.error("Error adding document: ", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

//function that fetches all messages for the checker
const fetchMessagesByUserPhone = async (phoneNo: string) => {
  try {
    //find all the voteRequests sent to user
    const factCheckerRef = db.doc(`factCheckers/${phoneNo}`);
    console.log(`Fetch messages by user phone: ${phoneNo}`);
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

        const message: TeleMessage = {
          id: doc.id,
          text: data.text || "",
          caption: data.caption || null,
          isAssessed: data.isAssessed || false,
          isMatch: data.primaryCategory === voteRequestData.category,
          primaryCategory: data.primaryCategory || null,
          voteRequests: {
            id: voteRequestDocRef.docs[0]?.id,
            factCheckerDocRef: voteRequestData.factCheckerDocRef || null,
            category: voteRequestData?.category || null,
            acceptedTimestamp: voteRequestData?.acceptedTimestamp || null,
            hasAgreed: voteRequestData?.hasAgreed || false,
            vote: voteRequestData?.vote || null,
            votedTimestamp: voteRequestData?.votedTimestamp || null,
            checkTimestamp: voteRequestData?.checkTimestamp || null,
            truthScore: voteRequestData?.truthScore || null,
            isView: (data.isAssessed && voteRequestData.checkTimestamp && voteRequestData.category) || (!data.isAssessed && voteRequestData.acceptedTimestamp && voteRequestData.hasAgreed) ? true : false,
          },
          rationalisation: data.rationalisation || null,
          truthScore: data.truthScore || null,
          firstTimestamp: data.firstTimestamp.toDate().toISOString() || new Date().toISOString(),
          //isView is true if the checker has read msg before
        };
        //print to see what the message obj looks like
        // console.log(message);
        messagesData.push(message);
      }
    }));
    // console.log(messagesData);
    return messagesData;
  } catch (err) {
    console.log(err);
    return [];
  }
};

//get all of checker's messages for myVotes page
app.get("/checkers/:phoneNo/messages", async (req, res) => {
  const phoneNo = req.params.phoneNo;
  // console.log(`Calling /api/getVotes with: ${phoneNo}`);
  const messages = await fetchMessagesByUserPhone(phoneNo);
  if (messages.length === 0) {
    console.log("No messages found");
  }
  else {
    console.log(messages);
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
        // console.log('Existing data:', voteRequestData);

        // Update the hasAgreed and acceptedTimestamp if its first time viewing file (not voted)
        if (data.isAssessed && voteRequestData.checkTimestamp == null && voteRequestData.category != null) {
          await voteRequestDoc.ref.update({
            checkTimestamp: Timestamp.fromDate(new Date()),
          });
        }
        //retrieve updated voteRequest from firebase
        const updatedVoteRequestDoc = await voteRequestDoc.ref.get();
        const updatedVoteRequestData = updatedVoteRequestDoc.data();

        const voteReq : VoteRequest = {
          id: updatedVoteRequestDoc.ref.id,
          factCheckerDocRef: updatedVoteRequestData?.factCheckerDocRef || null,
          category: updatedVoteRequestData?.category || null,
          acceptedTimestamp: updatedVoteRequestData?.acceptedTimestamp || null,
          hasAgreed: updatedVoteRequestData?.hasAgreed || false,
          vote: updatedVoteRequestData?.vote || null,
          votedTimestamp: updatedVoteRequestData?.votedTimestamp || null,
          checkTimestamp: updatedVoteRequestData?.checkTimestamp || null,
          truthScore: updatedVoteRequestData?.truthScore || null,
          isView: (data.isAssessed && updatedVoteRequestData?.checkTimestamp && updatedVoteRequestData.category) || (!data.isAssessed && updatedVoteRequestData?.acceptedTimestamp && updatedVoteRequestData.hasAgreed) ? true : false,
        };
        // console.log('Updated data:', voteReq);
        res.status(200).json({ success: true, voteRequest: voteReq });
        return;
      }
    }

  } catch (error) {
    console.error('Error fetching message:', error);
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
        // console.log('Existing data:', voteRequestDoc.data());
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
          truthScore: truthScore,
        });

        //retrieve updated voteRequest from firebase
        const updatedVoteRequestDoc = await voteRequestDoc.ref.get();
        const updatedVoteRequestData = updatedVoteRequestDoc.data();

        const voteReq : VoteRequest = {
          id: updatedVoteRequestDoc.ref.id,
          factCheckerDocRef: updatedVoteRequestData?.factCheckerDocRef || null,
          category: updatedVoteRequestData?.category || null,
          acceptedTimestamp: updatedVoteRequestData?.acceptedTimestamp || null,
          hasAgreed: updatedVoteRequestData?.hasAgreed || false,
          vote: updatedVoteRequestData?.vote || null,
          votedTimestamp: updatedVoteRequestData?.votedTimestamp || null,
          checkTimestamp: updatedVoteRequestData?.checkTimestamp || null,
          truthScore: updatedVoteRequestData?.truthScore || null,
          isView: (data?.isAssessed && updatedVoteRequestData?.checkTimestamp && updatedVoteRequestData.category) || (!data?.isAssessed && updatedVoteRequestData?.acceptedTimestamp && updatedVoteRequestData.hasAgreed) ? true : false,
        };
        console.log('Updated data:', voteReq);
        res.status(200).json({ success: true, voteRequest: voteReq });
      }
    }

  } catch (error) {
    console.error('Error updating vote request:', error);
    res.sendStatus(500);
  }

})


app.get("/checkerData", (req, res) => {
  //TODO TONGYING: To implement
  res.sendStatus(200)
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
