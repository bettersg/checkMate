import { defineString } from "firebase-functions/params"
import axios, { AxiosError } from "axios"
import * as functions from "firebase-functions"
import { GoogleAuth } from "google-auth-library"

const embedderHost = defineString("EMBEDDER_HOST")
const env = process.env.ENVIRONMENT

interface EmbedResponse {
  embedding: number[]
}

interface TrivialResponse {
  prediction: string
}

interface L1CategoryResponse {
  prediction: string
}

interface OCRResponse {
  image_type: string
  extracted_message: string
  subject: string
  sender: string
  prediction: string
}

interface camelCasedOCRResponse {
  imageType: string | null
  extractedMessage: string | null
  subject: string | null
  sender: string | null
  prediction: string | null
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
  const response = await callAPI<L1CategoryResponse>("getL1Category", data)
  return response.data.prediction
}

async function performOCR(storageURL: string): Promise<camelCasedOCRResponse> {
  const data = {
    url: storageURL,
  }
  const response = await callAPI<OCRResponse>("ocr", data)
  const camelCaseResponse = {
    imageType: response.data.image_type ?? null,
    extractedMessage: response.data.extracted_message ?? null,
    subject: response.data.subject ?? null,
    sender: response.data.sender ?? null,
    prediction: response.data.prediction ?? null,
  }
  return camelCaseResponse
}

async function getGoogleIdentityToken(audience: string) {
  try {
    const auth = new GoogleAuth()
    const client = await auth.getIdTokenClient(audience)
    const idToken = await client.idTokenProvider.fetchIdToken(audience)
    return idToken
  } catch (error) {
    if (env === "SIT" || env === "DEV") {
      functions.logger.log(
        "Unable to get Google identity token in lower environments"
      )
      return ""
    } else {
      if (error instanceof AxiosError) {
        functions.logger.error(error.message)
      } else {
        functions.logger.error(error)
      }
      throw new Error("Unable to get Google identity token in prod environment")
    }
  }
}

async function callAPI<T>(endpoint: string, data: object) {
  try {
    const hostName = embedderHost.value()
    // Fetch identity token
    const identityToken = await getGoogleIdentityToken(hostName)
    const response = await axios<T>({
      method: "POST", // Required, HTTP method, a string, e.g. POST, GET
      url: `${hostName}/${endpoint}`,
      data: data,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${identityToken}`,
        //apikey: process.env.ML_SERVER_TOKEN ?? "",
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

export { getEmbedding, checkTrivial, getL1Category, performOCR }
