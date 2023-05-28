import Typesense from "typesense"
import { defineString } from "firebase-functions/params"

const typesenseHost = defineString("TYPESENSE_HOST")
const typesensePort = defineString("TYPESENSE_PORT")
const typesenseProtocol = defineString("TYPESENSE_PROTOCOL")

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
