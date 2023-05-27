// typesenseClient.ts
import Typesense from "typesense";
import { defineString } from "firebase-functions/params";


const typesenseHost = defineString("TYPESENSE_HOST")

function getClient() {
  return new Typesense.Client({
    "nodes": [{
      "host": typesenseHost.value(),
      "port": 443,
      "protocol": "https",
    }],
    "apiKey": process.env.TYPESENSE_TOKEN ?? "",
    "connectionTimeoutSeconds": 10
  });
}

export { getClient }