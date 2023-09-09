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

interface L1CategoryResponse {
  prediction: string
}

interface OCRResponse {
  output: {
    sender_name_or_phone_number: string
    text_messages: {
      is_left: boolean
      text: string
    }[]
  }
  is_convo: boolean
  extracted_message: string
  sender: string
  prediction: string
}

interface camelCasedOCRResponse {
  output: {
    sender: string | null
    textMessages: {
      isLeft: boolean
      text: string
    }[]
  }
  isConvo: boolean | null
  extractedMessage: string | null
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

async function performOCR(url: string): Promise<camelCasedOCRResponse> {
  return {
    output: {
      sender: null,
      textMessages: [],
    },
    isConvo: null,
    extractedMessage: null,
    sender: null,
    prediction: null,
  }
  const data = {
    url: url,
  }
  const response = await callAPI<OCRResponse>("ocr", data)
  const camelCaseResponse = {
    output: {
      sender: response.data.output.sender_name_or_phone_number ?? null,
      textMessages: (response.data.output.text_messages ?? []).map(
        (message) => {
          return {
            isLeft: message.is_left,
            text: message.text,
          }
        }
      ),
    },
    isConvo: response.data.is_convo ?? null,
    extractedMessage: response.data.extracted_message ?? null,
    sender: response.data.sender ?? null,
    prediction: response.data.prediction ?? null,
  }
  return camelCaseResponse
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

export { getEmbedding, checkTrivial, getL1Category, performOCR }
