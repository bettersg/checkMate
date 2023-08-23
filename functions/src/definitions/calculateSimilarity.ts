//calculateSimilarity.ts
import * as admin from "firebase-admin"
import {
  vectorSearch,
  CollectionTypes,
} from "./common/typesense/collectionOperations"
import * as functions from "firebase-functions"
import { getEmbedding } from "./common/machineLearningServer/operations"
import { stripUrl, stripPhone } from "./common/utils"

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

async function calculateSimilarity(
  text: string,
  textHash: string,
  captionHash: string | null = null
) {
  //embed message to compare
  let similarity = {}
  const embedding = await getEmbedding(text)

  //try to match db first
  const matchedInstancesSnap = await db
    .collectionGroup(CollectionTypes.Instances)
    .where("textHash", "==", textHash)
    .where("captionHash", "==", captionHash)
    .get()
  if (!matchedInstancesSnap.empty) {
    const matchedInstanceSnap = matchedInstancesSnap.docs[0]
    similarity = {
      ref: matchedInstanceSnap.ref,
      message: matchedInstanceSnap.get("text"),
      captionHash: matchedInstanceSnap.get("captionHash") ?? null,
      score: 1,
      parent: matchedInstanceSnap.ref.parent.parent,
    }
  } else {
    if (stripPhone(stripUrl(text, false), false).length < 5) {
      // don't bother with vector search if remaining message is too short to be meaningful.
      functions.logger.log("Remaining message text too short to match")
      similarity = {}
    } else {
      const results = await vectorSearch(
        embedding,
        CollectionTypes.Instances,
        1,
        `captionHash:${captionHash ? captionHash : "__NULL__"}`
      )
      const nearestInstance = results?.[0]?.hits?.[0]
      if (nearestInstance) {
        const doc = nearestInstance.document
        const path = doc.id.replace(/_/g, "/") //typesense id can't seem to take /
        const similarityScore = 1 - nearestInstance.vector_distance
        const instanceRef = db.doc(path)
        const instanceSnap = await instanceRef.get()
        if (!instanceSnap.exists) {
          functions.logger.warn("Path doesn't exist in database")
        } else if (instanceSnap.get("text") != (doc.message ?? null)) {
          functions.logger.warn("Text doesn't match")
        } else
          similarity = {
            ref: instanceRef,
            message: doc.message,
            captionHash: instanceSnap.get("captionHash") ?? null,
            score: Math.round(similarityScore * 100) / 100,
            parent: instanceRef.parent.parent,
          }
      } else {
        functions.logger.warn("No similar instance found")
      }
    }
  }
  return {
    embedding: embedding,
    similarity: similarity,
  }
}

export { calculateSimilarity }
