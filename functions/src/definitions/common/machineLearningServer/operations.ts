import { defineString } from "firebase-functions/params"
import axios, { AxiosError } from "axios"
import * as functions from "firebase-functions"
import { GoogleAuth } from "google-auth-library"
import { AppEnv } from "../../../appEnv"
import { CommunityNote } from "../../../types"

const embedderHost = defineString(AppEnv.EMBEDDER_HOST)
const env = process.env.ENVIRONMENT

interface EmbedResponse {
  embedding: number[]
}

interface TrivialResponse {
  needsChecking: boolean
}

interface ControversialResponse {
  isControversial: boolean
}
interface CommunityNoteReturn
  extends Pick<CommunityNote, "en" | "cn" | "links"> {
  isControversial: boolean // Add your new field
  isVideo: boolean
  isAccessBlocked: boolean
  requestId?: string
  success?: boolean
  report?: string
  totalTimeTaken?: string
  errorMessage?: string
  agentTrace?: string[]
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

async function determineNeedsChecking(input: {
  text?: string
  url?: string
  caption?: string
}): Promise<boolean> {
  if (input.text && input.url) {
    functions.logger.error(
      "Both text and url provided to determineNeedsChecking"
    )
    return true
  }
  try {
    // Mock response in non-prod environment
    if (env !== "PROD") {
      // You can add more sophisticated mock logic here
      if (
        input.text?.toLowerCase().includes("trivial") ||
        input.caption?.toLowerCase().includes("trivial") ||
        input.text?.toLowerCase() == "hello"
      ) {
        return false
      }
      if (env === "SIT") {
        return true
      }
    }

    const data = { ...input }
    const response = await callAPI<TrivialResponse>("getNeedsChecking", data)
    return response.data.needsChecking
  } catch (error) {
    functions.logger.error(`Error in determineNeedsChecking: ${error}`)
    return true
  }
}

async function determineControversial(input: {
  text?: string
  url?: string | null
  caption?: string | null
}): Promise<boolean> {
  switch (env) {
    case "SIT":
      return false
    case "DEV":
      if (
        input.text?.toLowerCase().includes("controversial") ||
        input.caption?.toLowerCase().includes("controversial")
      ) {
        return true
      }
      return false
    default:
      break
  }
  const data = { ...input }
  try {
    const response = await callAPI<ControversialResponse>(
      "determineControversial",
      data
    )
    return response.data.isControversial
  } catch (error) {
    functions.logger.error(`Error in determineControversial: ${error}`)
    return false
  }
}

async function getCommunityNote(input: {
  text?: string
  url?: string | null
  caption?: string | null
  requestId?: string | null
}): Promise<CommunityNoteReturn> {
  if (env !== "PROD") {
    // You can add more sophisticated mock logic here
    if (env === "SIT") {
      throw new Error("Cannot call getCommunityNote in SIT environment")
    }
    if (env === "DEV") {
      return {
        en: "This is a test community note.",
        cn: "这是一个测试社区笔记。",
        links: ["https://example1.com", "https://example2.com"],
        isControversial:
          input.text?.toLowerCase().includes("controversial") || false,
        isVideo: input.text?.toLowerCase().includes("video") || false,
        isAccessBlocked: input.text?.toLowerCase().includes("blocked") || false,
      }
    }
  }

  try {
    const data: Record<string, any> = {} // Initialize an empty object

    // Populate `data` based on `input`
    if (input.text) {
      data.text = input.text
    } else {
      data.image_url = input.url // Rename `url` to `image_url`
      data.caption = input.caption
    }

    // Timeout logic
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => {
          reject(new Error("The API call timed out after 60 seconds"))
        },
        env === "PROD" ? 60000 : 120000
      )
    )

    // API call
    const apiCallPromise = callAPI<CommunityNoteReturn>(
      "v2/getCommunityNote",
      data,
      input.requestId
    )

    // Race between the API call and the timeout
    const response = await Promise.race([apiCallPromise, timeoutPromise])
    if (response.data?.success) {
      if (response.data?.requestId) {
        functions.logger.log(
          `Community note with request ID: ${response.data.requestId} successfully generated`
        )
      }
      return response.data
    } else {
      functions.logger.error(
        `Failed to generate community note with request ID: ${response.data?.requestId}`
      )
      throw new Error(
        response.data?.errorMessage ?? "An error occurred calling the API"
      )
    }
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "An error occurred calling the machine learning API"
    )
  }
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
  const response = await callAPI<OCRResponse>("ocr-v2", data)
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
    if (env === "SIT" || env === "DEV") {
      functions.logger.log(
        "Unable to get Google identity token in lower environments"
      )
      return ""
    }
    const auth = new GoogleAuth()
    const client = await auth.getIdTokenClient(audience)
    const idToken = await client.idTokenProvider.fetchIdToken(audience)
    return idToken
  } catch (error) {
    if (error instanceof AxiosError) {
      functions.logger.error(error.message)
    } else {
      functions.logger.error(error)
    }
    throw new Error("Unable to get Google identity token in prod environment")
  }
}

async function callAPI<T>(
  endpoint: string,
  data: object,
  requestId?: string | null
) {
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
        ...(requestId ? { "x-request-id": requestId } : {}),
      },
    })
    return response
  } catch (error) {
    if (error instanceof AxiosError) {
      functions.logger.log(error.message)
    } else {
      functions.logger.log(error)
    }
    throw new Error(
      error instanceof Error
        ? error.message
        : "An error occurred calling the machine learning API"
    )
  }
}

export {
  getEmbedding,
  determineNeedsChecking,
  getL1Category,
  performOCR,
  getCommunityNote,
  determineControversial,
}
