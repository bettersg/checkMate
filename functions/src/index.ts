import * as batchJobs from "./definitions/batchJobs"
import { setGlobalOptions } from "firebase-functions/v2"

setGlobalOptions({ region: "asia-southeast1" })

export { onInstanceCreate } from "./definitions/onInstanceCreate"
export { onInstanceDelete } from "./definitions/onInstanceDelete"
export { onInstanceUpdate } from "./definitions/onInstanceUpdate"
export { onMessageUpdate } from "./definitions/onMessageUpdate"
export { webhookHandlerV2 } from "./definitions/webhookHandler"
export { onVoteRequestUpdate } from "./definitions/onVoteRequestUpdate"
export { healthcheck } from "./definitions/healthcheck"
export { onMessageWrite } from "./definitions/updateTypesense"
export { onUserPublish } from "./definitions/userHandlers"
export { onCheckerPublish } from "./definitions/checkerHandlers"
export { batchJobs }
