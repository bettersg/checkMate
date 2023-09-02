import { getL1Category } from "./machineLearningServer/operations"

async function classifyText(text: string): Promise<string> {
  if (text.length < 8) {
    return "irrelevant_length"
  }
  const category = await getL1Category(text)
  if (category === "trivial") {
    return "irrelevant"
  } else {
    return category
  }
}

export { classifyText }
