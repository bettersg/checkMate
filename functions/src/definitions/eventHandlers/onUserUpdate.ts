import { onDocumentUpdated } from "firebase-functions/v2/firestore"
import { logger } from "firebase-functions/v2"
import { UserData } from "../../types"
import { sendFoundersMessage } from "../common/responseUtils"
import { getThresholds } from "../common/utils"

const onUserUpdate = onDocumentUpdated(
  {
    document: "users/{userId}",
    secrets: ["WHATSAPP_TOKEN", "WHATSAPP_USER_BOT_PHONE_NUMBER_ID"],
  },
  async (event) => {
    // Grab the current value of what was written to Firestore.
    try {
      const preChangeSnap = event?.data?.before
      const postChangeSnap = event?.data?.after
      if (!preChangeSnap || !postChangeSnap) {
        return Promise.resolve()
      }
      const postChangeData = postChangeSnap.data() as UserData

      if (!postChangeData?.whatsappId) {
        logger.error(
          `Missing whatsappId in postChangeData for ${postChangeSnap.id}`
        )
        return
      }

      if (process.env.ENVIRONMENT === "SIT") {
        return Promise.resolve()
      }
      const thresholds = await getThresholds()
      const numCommunityNotesReceived =
        postChangeData?.numCommunityNotesReceived ?? 0
      const viewedFoundersMessageCount =
        postChangeData?.viewedFoundersMessageCount ?? 0
      const sendAppealMessageThreshold =
        thresholds.sendAppealMessageThreshold ?? 3
      const isMillennialGenZ =
        postChangeData.ageGroup == "36-50" || postChangeData.ageGroup == "18-35"
      if (
        numCommunityNotesReceived == sendAppealMessageThreshold &&
        viewedFoundersMessageCount == 0 &&
        isMillennialGenZ
      ) {
        await sendFoundersMessage(postChangeSnap)
      }

      return Promise.resolve()
    } catch (error) {
      logger.error("Error in onUserUpdate:", error)
      return Promise.resolve()
    }
  }
)

export { onUserUpdate }
