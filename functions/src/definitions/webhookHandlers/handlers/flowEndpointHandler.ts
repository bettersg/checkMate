import * as admin from "firebase-admin"
import { Timestamp } from "firebase-admin/firestore"
import { getThresholds, translateFrequency } from "../../common/utils"
import { logger } from "firebase-functions/v2"
if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()
interface WhatsAppRequest {
  version: string // must be set to "3.0"
  action: "ping" | "INIT" | "BACK" | "data_exchange" // restricted to possible values
  screen?: string // optional, may not be populated for INIT or BACK
  data?: Record<string, string | boolean | number | object | any[]> // optional, key-value pairs of any type
  flow_token?: string // optional, required for data exchange flows
}

export async function flowEndpointHandler(decryptedBody: WhatsAppRequest) {
  switch (decryptedBody.action) {
    case "ping":
      // Handle the "ping" action
      return { data: { status: "active" } }
      break
    case "INIT":
      try {
        const flowToken = decryptedBody.flow_token
        if (!flowToken) {
          throw new Error("Flow token not found")
        }
        const flowRef = db.collection("flows").doc(flowToken)
        const flowSnap = await flowRef.get()
        if (!flowSnap.exists) {
          throw new Error("Flow not found in database")
        }
        flowRef.update({
          outcome: "opened",
          outcomeTimestamp: Timestamp.now(),
        })
        const thresholds = await getThresholds()
        let dataPayload
        let flowType = flowSnap.get("type")
        if (!flowType) {
          throw new Error("Flow type not found")
        }
        flowType = flowType.split("_")[0] //there is a language suffix that shoudl be removed
        let screen = "JOIN_WAITLIST"
        switch (flowType) {
          case "waitlist":
            screen = "LANDING"
            dataPayload = {
              num_paid_checks: String(thresholds.paidTierLimit ?? 30),
              price: String(thresholds.price ?? 5.99),
            }
            break
          case "onboarding":
            screen = "LANDING"
            dataPayload = {
              num_free_checks: String(thresholds.freeTierLimit ?? 5),
              frequency_en: thresholds.frequency ?? "monthly",
              frequency_cn: translateFrequency(
                thresholds.frequency ?? "monthly"
              ),
            }
            break
          default:
            throw new Error("Invalid flow type")
        }
        return {
          data: dataPayload,
          screen: screen,
        }
      } catch (error) {
        logger.error("Error fetching flow data", error)
        return {
          data: {
            error_message: "Error fetching flow data",
          },
          screen: "LANDING",
        }
      }
      break
    case "BACK":
      // Handle the "BACK" action
      break
    case "data_exchange":
      // Handle the "data_exchange" action
      break
  }
}
