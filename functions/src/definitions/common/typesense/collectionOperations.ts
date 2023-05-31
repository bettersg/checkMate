// collectionOperations.ts
import { getClient } from "./client"
import { defineString } from "firebase-functions/params"

const runtimeEnvironment = defineString("ENVIRONMENT")

enum CollectionTypes {
  Instances = "instances",
  Messages = "messages",
}

function getEnvSuffix(): string {
  if (runtimeEnvironment.value() !== "PROD") {
    return "Dev"
  } else {
    return "Prod"
  }
}

async function vectorSearch(
  embedding: Array<number>,
  collection: CollectionTypes,
  numResults: number = 1
): Promise<any> {
  try {
    let searchRequests = {
      searches: [
        {
          collection: `${collection}${getEnvSuffix()}`,
          q: "*",
          query_by: "message",
          per_page: numResults,
          vector_query: `embedding:([${embedding}], k:${numResults})`,
        },
      ],
    }
    let commonSearchParams = {}
    const response = await getClient().multiSearch.perform(
      searchRequests,
      commonSearchParams
    )
    return response.results
  } catch (error) {
    console.error("Error in vectorSearch: ", error)
  }
}

async function insertOne(
  document: Object,
  collection: CollectionTypes
): Promise<void> {
  try {
    await getClient()
      .collections(`${collection}${getEnvSuffix()}`)
      .documents()
      .create(document)
  } catch (error) {
    console.error("Error in insertOne: ", error)
    throw error
  }
}

async function updateOne(
  document: Object,
  collection: CollectionTypes
): Promise<void> {
  try {
    await getClient()
      .collections(`${collection}${getEnvSuffix()}`)
      .documents()
      .update(document)
  } catch (error) {
    console.error("Error in updateOne: ", error)
    throw error
  }
}

async function deleteOne(
  id: string,
  collection: CollectionTypes
): Promise<void> {
  try {
    await getClient()
      .collections(`${collection}${getEnvSuffix()}`)
      .documents(id)
      .delete()
  } catch (error) {
    console.error("Error in deleteOne: ", error)
    throw error
  }
}

async function upsertOne(
  document: Object,
  collection: CollectionTypes
): Promise<void> {
  try {
    await getClient()
      .collections(`${collection}${getEnvSuffix()}`)
      .documents()
      .upsert(document)
  } catch (error) {
    console.error("Error in upsertOne: ", error)
    throw error
  }
}

export {
  vectorSearch,
  insertOne,
  updateOne,
  deleteOne,
  upsertOne,
  CollectionTypes,
}
