// collectionOperations.ts
import { AppEnv } from "../../../appEnv"
import { getClient } from "./client"
import { defineString } from "firebase-functions/params"
import { logger } from "firebase-functions/v2"

const runtimeEnvironment = defineString(AppEnv.ENVIRONMENT)

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
  numResults: number = 1,
  filterBy: string | null = null
): Promise<any> {
  try {
    let searchRequests
    if (filterBy === null) {
      searchRequests = {
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
    } else {
      searchRequests = {
        searches: [
          {
            collection: `${collection}${getEnvSuffix()}`,
            q: "*",
            query_by: "message",
            filter_by: filterBy,
            per_page: numResults,
            vector_query: `embedding:([${embedding}], k:${numResults})`,
          },
        ],
      }
    }
    let commonSearchParams = {}
    const response = await getClient().multiSearch.perform(
      searchRequests,
      commonSearchParams
    )
    return response.results
  } catch (error) {
    logger.error("Error in vectorSearch: ", error)
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
    logger.error("Error in insertOne: ", error)
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
      .update(document, {})
  } catch (error) {
    logger.error("Error in updateOne: ", error)
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
    logger.error("Error in deleteOne: ", error)
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
    logger.error("Error in upsertOne: ", error)
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
