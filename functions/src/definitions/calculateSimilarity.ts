//calculateSimilarity.ts
import * as admin from 'firebase-admin';
import { vectorSearch, CollectionTypes } from "./common/typesense/collectionOperations"
import * as functions from 'firebase-functions';

if (!admin.apps.length) {
  admin.initializeApp()
}

async function calculateSimilarity(embedding: number[]) {
  //embed message to compare
  const results = await vectorSearch(embedding, CollectionTypes.Instances, 1)
  const nearestInstance = results?.[0]?.hits?.[0]
  if (nearestInstance) {
    const doc = nearestInstance.document
    const path = nearestInstance.document.id.replace(/_/g, "/") //typesense id can't seem to take /
    const similarityScore = 1 - nearestInstance.vector_distance
    const db = admin.firestore()
    const instanceRef = db.doc(path)
    const instanceSnap = await instanceRef.get();
    if (!instanceSnap.exists) {
      functions.logger.warn("Path doesn't exist in database");
      return {}
    }
    return {
      ref: instanceRef,
      message: doc.message,
      score: Math.round(similarityScore * 100) / 100,
      parent: instanceRef.parent.parent,
    }
  } else {
    functions.logger.warn("No similar instance found");
    return {}
  }
}

export { calculateSimilarity }