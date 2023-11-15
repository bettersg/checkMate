import * as admin from "firebase-admin"
import express from "express"
import { validateFirebaseIdToken } from "./middleware/validator"
import { onRequest } from "firebase-functions/v2/https"
import { Timestamp, collectionGroup, query, where, getDocs } from "firebase/firestore";
import { DocumentReference } from '@google-cloud/firestore';

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const app = express()
// app.use(validateFirebaseIdToken) //TODO: uncomment if you want to turn off validation

app.get("/helloworld", (req, res) => {
  res.send({ hello: "hello from /helloworld" })
})

interface VoteRequest {
  factCheckerDocRef: string;
  category: string | null;
  acceptedTimestamp: Timestamp | null;
  hasAgreed: boolean;
  vote: number | null;
  votedTimestamp: Timestamp | null;
}

interface Message {
  id: string;
  caption: string | null;
  text: string;
  isAssessed: boolean;
  isMatch: boolean;
  primaryCategory: string;
  voteRequests: VoteRequest;
  justification: string;
  truthScore: number | null;
  isView: boolean //checks if checker has clicked in to view results/msg
}

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
    let messagesData: Message[] = [];

    await Promise.all(messagesQuery.map( async (doc) => {
      const data = doc.data();
      if (data){
        // Fetch the specific document from the voteRequests subcollection
        const voteRequestDocRef = await doc.ref.collection("voteRequests")
        .where("factCheckerDocRef", "==", `/factCheckers/${userId}`)
        .limit(1)
        .get();

        const voteRequestData = voteRequestDocRef.docs[0]?.data();

        const message: Message = {
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
          justification: data.justification || null,
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

app.post("/getVotes", async (req, res) => {
  const userId = req.body.userId;
  console.log(userId); 
  const messages = await fetchMessagesByUserId(userId);
  return res.json({ messages: messages})
})

app.get("/voteRequest", (req, res) => {
  //TODO TONGYING: To implement
  res.sendStatus(200)
})

app.post("/voteRequest", (req, res) => {
  //TODO TONGYING: To implement, probably when they vote here
  res.sendStatus(200)
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
