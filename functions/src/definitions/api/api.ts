import * as admin from "firebase-admin"
import express from "express"
import { validateFirebaseIdToken } from "./middleware/validator"
import { onRequest } from "firebase-functions/v2/https"
import { Timestamp, collectionGroup, query, where, serverTimestamp } from "firebase/firestore";
import { DocumentReference } from '@google-cloud/firestore';
import { TeleMessage } from "../../types";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const app = express()
// app.use(validateFirebaseIdToken) //TODO: uncomment if you want to turn off validation

app.get("/helloworld", (req, res) => {
  res.send({ hello: "hello from /helloworld" })
})

const fetchMessagesByUserId = async (userId: string) => {
  try {
    //find all the voteRequests sent to user
    const voteRequestsSnapshot = await db
      .collectionGroup("voteRequests")
      .where("factCheckerDocRef", "==", `/factCheckers/${userId}`)
      .get();

    //find the corresponding messages doc id
    const documentIds: string[] = [];
    voteRequestsSnapshot.forEach((doc) => {
      const parentId = doc.ref.parent?.parent?.id;
      if (parentId){
        documentIds.push(parentId)
      }
    });
    //get all the messages doc
    const messagesQuery = await Promise.all(
      documentIds.map(async (documentId) => {
        const doc = await db.collection("messages").doc(documentId).get();
        return doc;
      })
    );
    
    //convert each messages doc into Message object
    let messagesData: TeleMessage[] = [];

    await Promise.all(messagesQuery.map( async (doc) => {
      const data = doc.data();
      if (data){
        // Fetch the specific document from the voteRequests subcollection
        const voteRequestDocRef = await doc.ref.collection("voteRequests")
        .where("factCheckerDocRef", "==", `/factCheckers/${userId}`)
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
            factCheckerDocRef: voteRequestData.factCheckerDocRef || "",
            category: voteRequestData?.category || null,
            acceptedTimestamp: voteRequestData?.acceptedTimestamp || null, 
            hasAgreed: voteRequestData?.hasAgreed || false, 
            vote: voteRequestData?.vote || null,
            votedTimestamp: voteRequestData?.votedTimestamp || null, 
          },
          rationalisation: data.rationalisation || null,
          truthScore: data.truthScore || null,
          //edit isView logic (read/unread)
          isView: (voteRequestData && voteRequestData.acceptedTimestamp) ? true : false,
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

//get all messages for myVotes page
app.post("/getVotes", async (req, res) => {
  const userId = req.body.userId;
  console.log(userId); 
  const messages = await fetchMessagesByUserId(userId);
  return res.json({ messages: messages})
})

//get info for voting page, set isView to true
app.post("/getVoteRequest", async (req, res) => {
  //TODO TONGYING: To implement
  const userId = req.body.userId;
  const msgId = req.body.msgId;
  try {
    const messageDoc = await db.collection('messages').doc(msgId).get();

    if (!messageDoc.exists) {
      res.status(404).json({ error: 'Message not found' });
    } 
    
    const data = messageDoc.data();
      if (data){
        // Access the VoteRequests subcollection
        const voteRequestsCollection = messageDoc.ref.collection('voteRequests');

        // Query to get the specific VoteRequest document by checker
        const voteRequestQuery = await voteRequestsCollection
          .where('factCheckerDocRef', '==', `/factCheckers/${userId}`)
          .get();

        if (voteRequestQuery.docs.length === 0) {
          return res.status(404).json({ error: 'VoteRequest not found' });
        } else {
          const voteRequestDoc = voteRequestQuery.docs[0];
          const voteRequestData = voteRequestDoc.data();
          // Update the isAccepted and acceptedTimestamp if its first time viewing file
          if (voteRequestData.isAccepted == false){
              await voteRequestDoc.ref.update({
              isAccepted: true,
              acceptedTimestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          const message: TeleMessage = {
            id: messageDoc.id,
            text: data.text || "",
            caption: data.caption || null,
            isAssessed: data.isAssessed || false,
            isMatch: data.primaryCategory === voteRequestData.category,
            primaryCategory: data.primaryCategory || null,
            voteRequests: {
              factCheckerDocRef: voteRequestData.factCheckerDocRef || "",
              category: voteRequestData?.category || null,
              acceptedTimestamp: voteRequestData?.acceptedTimestamp || null, 
              hasAgreed: voteRequestData?.hasAgreed || false, 
              vote: voteRequestData?.vote || null,
              votedTimestamp: voteRequestData?.votedTimestamp || null, 
            },
            rationalisation: data.rationalisation || null,
            truthScore: data.truthScore || null,
            //edit isView logic (read/unread)
            isView: (voteRequestData && voteRequestData.acceptedTimestamp) ? true : false,
          };
          res.status(200).json({ message: message });
          return;
        }
      }
     
  } catch (error) {
    console.error('Error fetching message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
  
})

//vote for a message
app.post("/vote", async (req, res) => {
  //TODO TONGYING: To implement, probably when they vote here
  const vote = req.body.vote;
  const msgId = req.body.msgId;
  const userId = req.body.userId;

    try {
      // Reference to the message document
      const messageRef = db.collection('messages').doc(msgId);
  
      // Reference to the VoteRequests subcollection
      const voteRequestsCollection = messageRef.collection('voteRequests');
  
      // Query to get the specific VoteRequest document by checker
      const voteRequestQuery = await voteRequestsCollection
        .where('factCheckerDocRef', '==', `/factCheckers/${userId}`)
        .get();
  
        if (voteRequestQuery.empty) {
          res.status(404).json({ error: 'VoteRequest not found' });
        } else {
          
          // Assuming there's only one matching document, you can retrieve it
          const voteRequestDoc = voteRequestQuery.docs[0];
          console.log('Existing data:', voteRequestDoc.data());
          if (!voteRequestDoc) {
            res.status(404).json({ error: 'VoteRequest document not found' });
          } else {
            // Update the document
            await voteRequestDoc.ref.update({
              category: vote,
              votedTimestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        
            res.status(200).json({ success: true });}
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
