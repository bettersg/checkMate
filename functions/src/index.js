const onInstanceCreate = require("./definitions/onInstanceCreate")
const onMessageUpdate = require("./definitions/onMessageUpdate")
const webhookHandler = require("./definitions/webhookHandler")
const onVoteRequestUpdate = require("./definitions/onVoteRequestUpdate")
const batchJobs = require("./definitions/batchJobs")
const healthcheck = require("./definitions/healthcheck")

// our stuff, uncomment when ready!
exports.onInstanceCreate = onInstanceCreate.onInstanceCreate
exports.onMessageUpdate = onMessageUpdate.onMessageUpdate
exports.webhookHandler = webhookHandler.webhookHandler
exports.onVoteRequestUpdate = onVoteRequestUpdate.onVoteRequestUpdate
exports.batchJobs = batchJobs
exports.healthcheck = healthcheck.healthcheck
