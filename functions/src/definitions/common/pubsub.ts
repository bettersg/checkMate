import { PubSub } from "@google-cloud/pubsub"
import * as functions from "firebase-functions"

const env = process.env.ENVIRONMENT

let pubsub: PubSub

if (env === "PROD") {
  pubsub = new PubSub()
} else {
  pubsub = new PubSub({
    apiEndpoint: "localhost:8085",
  })
}

async function publishToTopic(
  topicName: string,
  messageData: object,
  source: string
) {
  if (env !== "PROD") {
    const [exists] = await pubsub.topic(topicName).exists() //Doesn't seem to autocreate in emulator
    if (!exists) {
      await pubsub.createTopic(topicName)
    }
  }
  const topic = pubsub.topic(topicName)
  try {
    // Publish the message
    const messageId = await topic.publishMessage({
      json: messageData,
      attributes: {
        source: source,
      },
    })
    functions.logger.log(`Message ${messageId} published.`)
  } catch (error) {
    functions.logger.log(`Error publishing message: ${error}`)
  }
}

export { publishToTopic }
