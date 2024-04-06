import Typesense from "typesense"
import { defineString } from "firebase-functions/params"
import { AppEnv } from "../../../appEnv"

const typesenseHost = defineString(AppEnv.TYPESENSE_HOST)
const typesensePort = defineString(AppEnv.TYPESENSE_PORT)
const typesenseProtocol = defineString(AppEnv.TYPESENSE_PROTOCOL)

function getClient() {
  return new Typesense.Client({
    nodes: [
      {
        host: typesenseHost.value(),
        port: Number(typesensePort.value()),
        protocol: typesenseProtocol.value(),
      },
    ],
    apiKey: process.env.TYPESENSE_TOKEN ?? "",
    connectionTimeoutSeconds: 10,
  })
}

export { getClient }
