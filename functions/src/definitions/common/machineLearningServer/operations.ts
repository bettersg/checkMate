//operations.ts

import { defineString } from "firebase-functions/params";
import axios, { AxiosResponse } from "axios";
import * as functions from 'firebase-functions';

const embedderHost = defineString("EMBEDDER_HOST")

interface EmbedResponse {
  data: {
    embedding: number[];
  };
}

interface TrivialResponse {
  data: {
    prediction: string;
  };
}

async function getEmbedding(text: string): Promise<number[]> {
  const data = {
    text: text
  }
  const response = await callAPI<EmbedResponse>("embed", data);
  return response.data.embedding
}

async function checkTrivial(text: string): Promise<string> {
  const data = {
    text: text
  }
  const response = await callAPI<TrivialResponse>("checkTrivial", data);
  return response.data.prediction
}

async function callAPI<T>(endpoint: string, data: object): Promise<AxiosResponse> {
  const response: AxiosResponse<T> = await axios({
    method: "POST", // Required, HTTP method, a string, e.g. POST, GET
    url: `${embedderHost.value()}/${endpoint}`,
    data: data,
    headers: {
      "Content-Type": "application/json",
      "apikey": process.env.ML_SERVER_TOKEN ?? "",
    },
  }).catch((error) => {
    functions.logger.log(error.response.data);
    throw new Error("An error occurred calling the machine learning API");
  });
  return response
}

export { getEmbedding, checkTrivial }