import * as batchJobs from "./definitions/batchJobs/batchJobs"
import { setGlobalOptions } from "firebase-functions/v2"

setGlobalOptions({ region: "asia-southeast1" })

export { onInstanceCreate } from "./definitions/eventHandlers/onInstanceCreate"
export { onInstanceDelete } from "./definitions/eventHandlers/onInstanceDelete"
export { onInstanceUpdate } from "./definitions/eventHandlers/onInstanceUpdate"
export { onMessageUpdate } from "./definitions/eventHandlers/onMessageUpdate"
export { webhookHandlerV2 } from "./definitions/webhookHandlers/handler"
export { onVoteRequestUpdate } from "./definitions/eventHandlers/onVoteRequestUpdate"
export { healthcheck } from "./definitions/healthcheck"
export { onMessageWrite } from "./definitions/eventHandlers/updateTypesense"
export { onUserPublish } from "./definitions/eventHandlers/userHandlers"
export { onCheckerPublish } from "./definitions/eventHandlers/checkerHandlerWhatsapp"
export { telegramAuthHandler } from "./definitions/api/authentication"
export { onCheckerPublishTelegram } from "./definitions/eventHandlers/checkerHandlerTelegram"
export { apiHandler } from "./definitions/api/api"
export { internalApiHandler } from "./definitions/api/apiInternal"
export { batchJobs }
