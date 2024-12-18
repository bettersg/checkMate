import { getL1Category } from "./machineLearningServer/operations"
import * as functions from "firebase-functions"

async function classifyText(text: string): Promise<string> {
  if (text.length < 8) {
    return "irrelevant_length"
  }
  try {
    const category = await getL1Category(text)
    if (category === "trivial" || category === "irrelevant") {
      return "unsure"
    } else {
      return category
    }
  } catch (e) {
    functions.logger.error(`Error in classifyText: ${e}`)
    return "error"
  }
}

export { classifyText }
