import { getFunctions } from "firebase-admin/functions"
import { logger } from "firebase-functions/v2"
import { GoogleAuth } from "google-auth-library"

async function enqueueTask(
  payload: Record<string, any>,
  functionName: string,
  delaySeconds: number = 0,
  location: string = "asia-southeast1"
) {
  try {
    const targetUri = await getFunctionUrl(functionName)
    const queue = getFunctions().taskQueue(
      `locations/${location}/functions/${functionName}`
    )
    await queue.enqueue(payload, {
      scheduleDelaySeconds: delaySeconds,
      uri: targetUri,
    })
  } catch (e) {
    if (
      process.env.ENVIRONMENT === "DEV" ||
      process.env.ENVIRONMENT === "SIT"
    ) {
      // cant seem to test this in local emulator as I get an error Failed to determine service account. Initialize the SDK with service account credentials or set service account ID as an app option.
      logger.log("Unable to enqueue task..")
    } else {
      logger.error(`Error enqueuing task for function ${functionName}: ${e}`)
    }
  }
}

async function getFunctionUrl(
  name: string,
  location: string = "asia-southeast1"
) {
  if (process.env.ENVIRONMENT === "DEV") {
    return `http://localhost:5001/checkmate-uat/${location}/${name}`
  }
  const auth = new GoogleAuth()
  const projectId = await auth.getProjectId()
  const url =
    "https://cloudfunctions.googleapis.com/v2/" +
    `projects/${projectId}/locations/${location}/functions/${name}`

  const client = await auth.getClient()
  const res = await client.request<any>({ url })
  const uri = res.data?.serviceConfig?.uri
  if (!uri) {
    throw new Error(`Unable to retreive uri for function at ${url}`)
  }
  return uri
}

export { enqueueTask }
