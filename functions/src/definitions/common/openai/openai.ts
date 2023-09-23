import OpenAI from "openai"

// Define the expected type for a chat message
type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

type examples = {
  user: string
  assistant: string
}

async function callChatCompletion(
  model: string,
  systemMessage: string,
  examples: examples[],
  user: string,
  temperature: number = 0
): Promise<string | null> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  const messages: ChatMessage[] = [{ role: "system", content: systemMessage }]
  examples.forEach((example) => {
    messages.push({
      role: "user",
      content: example.user,
    })
    messages.push({
      role: "assistant",
      content: example.assistant,
    })
  })
  messages.push({ role: "user", content: user })
  const chatCompletion = await openai.chat.completions.create({
    messages: messages,
    model: model,
    temperature: temperature,
  })
  return chatCompletion.choices[0].message.content
}

export { callChatCompletion, ChatMessage, examples }
