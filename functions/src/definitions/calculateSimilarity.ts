//calculateSimilarity.ts
import * as admin from "firebase-admin"
import {
  vectorSearch,
  CollectionTypes,
} from "./common/typesense/collectionOperations"
import * as functions from "firebase-functions"

if (!admin.apps.length) {
  admin.initializeApp()
}

async function calculateSimilarity(
  embedding: number[],
  captionHash: string | null = null
) {
  //embed message to compare
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
    const db = admin.firestore()
    const instanceRef = db.doc(path)
    const instanceSnap = await instanceRef.get()
    if (!instanceSnap.exists) {
      functions.logger.warn("Path doesn't exist in database")
      return {}
    }
    if (instanceSnap.get("text") != (doc.message ?? null)) {
      functions.logger.warn("Text doesn't match")
      return {}
    }
    if (instanceSnap.get("caption") != (doc.caption ?? null)) {
      functions.logger.warn("Caption doesn't match")
      return {}
    }
    return {
      ref: instanceRef,
      message: doc.message,
      captionHash: instanceSnap.get("captionHash") ?? null,
      score: Math.round(similarityScore * 100) / 100,
      parent: instanceRef.parent.parent,
    }
  } else {
    functions.logger.warn("No similar instance found")
    return {}
  }
}

export { calculateSimilarity }
