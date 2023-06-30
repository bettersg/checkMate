import * as functions from "firebase-functions"

export type FirebaseRequest = functions.Request
export type FirebaseResponse = functions.Response

export type RequestWithWhatsappWebhookMessage = Omit<
  FirebaseRequest,
  "body"
> & {
  body: WhatsappWebhook
}

export type WhatsappWebhook = {
  object: string
  entry: {
    id: string
    changes: {
      value: {
        messaging_product: string
        metadata: {
          display_phone_number: string
          phone_number_id: string
        }
        contacts: {
          profile: {
            name: string
          }
          wa_id: string
        }[]
        messages: WhatsappMessage[]
      }
      field: string
    }[]
  }[]
}

export type WhatsappMessage = {
  from: string
  id: string
  timestamp: string
  text: {
    body: string
  }
  type: string
}

export type Thresholds = {
  endVote: number | string
  endVoteSus: number | string
  endVoteUnsure: number | string
  startVote: number | string
  isSpam: number | string
  isLegitimate: number | string
  isInfo: number | string
  isIrrelevant: number | string
  isUnsure: number | string
  isSus: number | string
  falseUpperBound: number | string
  misleadingUpperBound: number | string
}
