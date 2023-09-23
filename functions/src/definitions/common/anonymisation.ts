import { callChatCompletion, ChatMessage, examples } from "./openai/openai"
import hyperparameters from "./openai/hyperparameters.json"
import * as functions from "firebase-functions"

type redaction = {
  text: string
  replaceWith: string
}

const env = process.env.ENVIRONMENT

async function anonymiseMessage(message: string) {
  if (env === "SIT") {
    return message
  }
  let returnMessage = message.replace(/\u00a0/g, " ")
  try {
    const anonymisationHyperparameters = hyperparameters?.anonymisation
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
          userMessage
        )
        if (response) {
          try {
            const responseObj = JSON.parse(response)
            const redactions: redaction[] = responseObj.redacted
            console.log(redactions)
            redactions.forEach((redaction) => {
              let regex = new RegExp(redaction.text, "g")
              returnMessage = returnMessage.replace(
                regex,
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
        }
      } else {
        functions.logger.error(
          "Anonymisation hyperparameters not configured correctly"
        )
        return message
      }
    }
  } catch (e) {
    functions.logger.error("Anonymisation hyperparameters failed: " + e)
    return message
  }
}

export { anonymiseMessage }
