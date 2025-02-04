import { onDocumentUpdated } from "firebase-functions/v2/firestore"
import { logger } from "firebase-functions/v2"
import { UserData } from "../../types"
import { sendWhatsappTemplateMessage } from "../common/sendWhatsappMessage"

const onUserWhitelist = onDocumentUpdated(
  {
    document: "users/{userId}",
    secrets: ["WHATSAPP_TOKEN", "WHATSAPP_USER_BOT_PHONE_NUMBER_ID"],
  },
  async (event) => {
    // Grab the current value of what was written to Firestore.
    const preChangeSnap = event?.data?.before
    const postChangeSnap = event?.data?.after
    if (!preChangeSnap || !postChangeSnap) {
      return Promise.resolve()
    }
    const preChangeData = preChangeSnap.data() as UserData
    const postChangeData = postChangeSnap.data() as UserData

    if (!postChangeData?.whatsappId) {
      logger.error(
        `Missing whatsappId in postChangeData for ${postChangeSnap.id}`
      )
      return
    }

    const preChangeIsOnboardingComplete = preChangeData?.isOnboardingComplete
    const postChangeIsOnboardingComplete = postChangeData?.isOnboardingComplete
    const preChangeIsTester = preChangeData?.isTester
    const postChangeIsTester = postChangeData?.isTester
    const isAlreadyOnboardedUser =
      postChangeIsOnboardingComplete === null || postChangeIsOnboardingComplete

    if (
      (isAlreadyOnboardedUser && !preChangeIsTester && postChangeIsTester) ||
      (!preChangeIsOnboardingComplete &&
        postChangeIsOnboardingComplete &&
        postChangeIsTester)
    ) {
      await sendWhatsappTemplateMessage(
        "user",
        postChangeData?.whatsappId,
        "checkmate_beta_onboarding",
        "en"
      )
    }

    return Promise.resolve()
  }
)

export { onUserWhitelist }
