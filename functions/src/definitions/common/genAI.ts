import { callChatCompletion, ChatMessage, examples } from "./openai/openai"
import hyperparameters from "./openai/hyperparameters.json"
import * as functions from "firebase-functions"
import { stripUrl, stripPhone, checkUrlPresence } from "./utils"
//import RE2 from "re2"

type redaction = {
  text: string
  replaceWith: string
}

const env = process.env.ENVIRONMENT

async function anonymiseMessage(
  message: string,
  isComplex: boolean = true
): Promise<string> {
  if (env === "SIT") {
    return message
  }
  let returnMessage = message.replace(/\u00a0/g, " ")
  try {
    let anonymisationHyperparameters = isComplex
      ? hyperparameters?.complexAnonymisation
      : hyperparameters?.simpleAnonymisation
    if (anonymisationHyperparameters) {
      const model: string = anonymisationHyperparameters.model
      const systemMessage: string = anonymisationHyperparameters?.prompt?.system

      const examples: examples[] =
        anonymisationHyperparameters?.prompt?.examples
      const userMessage: string =
        anonymisationHyperparameters?.prompt?.user.replace(
          "{{message}}",
          message
        )
      if (model && systemMessage && examples && userMessage) {
        const response = await callChatCompletion(
          model,
          systemMessage,
          examples,
          userMessage,
          0,
          isComplex ? false : true, //update when GPT-4 ready
          11
        )
        if (response) {
          try {
            const responseObj = JSON.parse(response)
            const redactions: redaction[] = responseObj.redacted
            redactions.forEach((redaction) => {
              returnMessage = returnMessage.replaceAll(
                redaction.text,
                redaction.replaceWith
              )
            })
            return returnMessage
          } catch (e) {
            functions.logger.error(
              "OpenAI completion could not be parsed as JSON" + e
            )
            return message
          }
        } else {
          functions.logger.error("No response returned from openAI api")
          return message
        }
      } else {
        functions.logger.error(
          "Anonymisation hyperparameters not configured correctly"
        )
        return message
      }
    } else {
      return message
    }
  } catch (e) {
    functions.logger.error("Anonymisation failed: " + e)
    return message
  }
}

async function rationaliseMessage(message: string, category: string) {
  if (category.includes("irrelevant") || category === "unsure") {
    return null
  }
  if (env === "SIT") {
    return "This is a rationalisation"
  }
  let meaningfulLength: number = 300
  switch (category) {
    case "illicit":
      meaningfulLength = 50
      break
    case "scam":
      meaningfulLength = 50
      break
    case "spam":
      meaningfulLength = 75
      break
    default:
      if (checkUrlPresence(message)) {
        return null
      }
  }
  if (stripPhone(stripUrl(message, false), false).length < meaningfulLength) {
    //don't bother with rationalisation if remaining message is too short to be meaningful.
    return null
  }
  try {
    const rationalisationHyperparameters = hyperparameters?.rationalisation
    const model: string = rationalisationHyperparameters.model
    const systemMessage: string = rationalisationHyperparameters?.prompt?.system

    const examples: examples[] =
      rationalisationHyperparameters?.prompt?.examples
    const userMessage: string = rationalisationHyperparameters?.prompt?.user
      .replace("{{message}}", message)
      .replace("{{category}}", category)
    if (model && systemMessage && examples && userMessage) {
      const response = await callChatCompletion(
        model,
        systemMessage,
        examples,
        userMessage
      )
      if (response) {
        return response
      } else {
        functions.logger.error("No response returned from openAI api")
        return null
      }
    }
  } catch (e) {
    functions.logger.error("Rationalisation failed: " + e)
    return null
  }
  return null
}

export { anonymiseMessage }
