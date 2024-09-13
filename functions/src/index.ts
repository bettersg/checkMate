import * as batchJobs from "./definitions/batchJobs/batchJobs"
import { setGlobalOptions } from "firebase-functions/v2"

setGlobalOptions({ region: "asia-southeast1" })

export { onInstanceCreateV2 } from "./definitions/eventHandlers/onInstanceCreate"
export { onInstanceDeleteV2 } from "./definitions/eventHandlers/onInstanceDelete"
export { onInstanceUpdateV2 } from "./definitions/eventHandlers/onInstanceUpdate"
export { onMessageUpdateV2 } from "./definitions/eventHandlers/onMessageUpdate"
export { onCheckerUpdateV2 } from "./definitions/eventHandlers/onCheckerUpdate"
export { webhookHandlerV2 } from "./definitions/webhookHandlers/handler"
export { onVoteRequestUpdateV2 } from "./definitions/eventHandlers/onVoteRequestUpdate"
export { healthcheckV2 } from "./definitions/healthcheck"
export { onMessageWriteV2 } from "./definitions/eventHandlers/updateTypesense"
export { onUserPublish } from "./definitions/eventHandlers/userHandlers"
export { onCheckerPublish } from "./definitions/eventHandlers/checkerHandlerWhatsapp"
export { onUserInteractivePublish } from "./definitions/eventHandlers/userHandlerWhatsappInteractive"
export { telegramAuthHandler } from "./definitions/api/authentication"
export { onCheckerPublishTelegram } from "./definitions/eventHandlers/checkerHandlerTelegram"
export { apiHandler } from "./definitions/api/api"
export { internalApiHandler } from "./definitions/api/apiInternal"
export { batchJobs }
