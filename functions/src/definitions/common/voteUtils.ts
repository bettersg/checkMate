import * as functions from "firebase-functions"
import * as admin from "firebase-admin"

async function resetL2Status(
  voteRequestSnap: admin.firestore.DocumentSnapshot
) {
  try {
    const updateObj: { [key: string]: any } = {}
    if (voteRequestSnap.get("triggerL2Vote") !== null) {
      updateObj.triggerL2Vote = null
    }
    if (voteRequestSnap.get("triggerL2Others") !== null) {
      updateObj.triggerL2Others = null
    }
    if (Object.keys(updateObj).length) {
      // only perform the update if there's something to update
      await voteRequestSnap.ref.update(updateObj)
    }
  } catch (error) {
    functions.logger.error(
      "Error resetting triggerL2Vote or triggerL2Others",
      error
    )
  }
}

export { resetL2Status }
