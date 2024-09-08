import { getFunctions } from "firebase-admin/functions"
import { logger } from "firebase-functions/v2"
import { GoogleAuth } from "google-auth-library"

async function enqueueTask(
  payload: Record<string, any>,
  functionName: string,
  delaySeconds: number = 0
) {
  try {
    const targetUri = await getFunctionUrl(functionName)
    const queue = getFunctions().taskQueue(functionName)
    await queue.enqueue(payload, {
      scheduleDelaySeconds: delaySeconds,
      uri: targetUri,
    })
  } catch (e) {
    logger.error(`Error enqueuing task for function ${functionName}: ${e}`)
  }
}

async function getFunctionUrl(
  name: string,
  location: string = "asia-southeast1"
) {
  const auth = new GoogleAuth({
    scopes: "https://www.googleapis.com/auth/cloud-platform",
  })
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
