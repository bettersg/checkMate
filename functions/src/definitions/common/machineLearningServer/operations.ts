import { defineString } from "firebase-functions/params"
import axios, { AxiosError } from "axios"
import * as functions from "firebase-functions"

const embedderHost = defineString("EMBEDDER_HOST")

interface EmbedResponse {
  embedding: number[]
}

interface TrivialResponse {
  prediction: string
}

async function getEmbedding(text: string): Promise<number[]> {
  const data = {
    text: text,
  }
  const response = await callAPI<EmbedResponse>("embed", data)
  return response.data.embedding
}

async function checkTrivial(text: string): Promise<string> {
  const data = {
    text: text,
  }
  const response = await callAPI<TrivialResponse>("checkTrivial", data)
  return response.data.prediction
}

async function getL1Category(text: string): Promise<string> {
  const data = {
    text: text,
  }
  const response = await callAPI<TrivialResponse>("getL1Category", data)
  return response.data.prediction
}

async function callAPI<T>(endpoint: string, data: object) {
  try {
    const response = await axios<T>({
      method: "POST", // Required, HTTP method, a string, e.g. POST, GET
      url: `${embedderHost.value()}/${endpoint}`,
      data: data,
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.ML_SERVER_TOKEN ?? "",
      },
    })
    return response
  } catch (error) {
    if (error instanceof AxiosError) {
      functions.logger.log(error.message)
    } else {
      functions.logger.log(error)
    }
    throw new Error("An error occurred calling the machine learning API")
  }
}

export { getEmbedding, checkTrivial, getL1Category }
