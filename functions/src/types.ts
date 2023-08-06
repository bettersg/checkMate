export type WhatsappMessage = {
  from: string
  id: string
  timestamp: string
  text: {
    body: string
  }
  type: string
}

export type WhatsappButton = {
  type: string
  reply: {
    id: string
    title: string
  }
}
