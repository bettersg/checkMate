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

interface ChatCompletionParams {
  messages: ChatMessage[]
  model: string
  temperature: number
  response_format?: string // Making response_format optional
  seed?: number
}

async function callChatCompletion(
  model: string,
  systemMessage: string,
  examples: examples[],
  user: string,
  temperature: number = 0,
  returnJSON: boolean = false,
  seed: number | null = null
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
  const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming =
    {
      messages: messages,
      model: model,
      temperature: temperature,
    }
  if (seed) {
    params.seed = seed
  }
  if (returnJSON) {
    params.response_format = { type: "json_object" }
  }

  const chatCompletion = await openai.chat.completions.create(params)
  return chatCompletion.choices[0].message.content
}

export { callChatCompletion, ChatMessage, examples }
