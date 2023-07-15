export type WhatsappMessage = {
  from: string
  id: string
  timestamp: string
  text: {
    body: string
  }
  type: string
}
