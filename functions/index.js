const onInstanceCreate =
  require("./definitions/onInstanceCreate");
const onMessageUpdate =
  require("./definitions/onMessageUpdate");
const webhookHandler =
  require("./definitions/webhookHandler");
const onVoteRequestUpdate =
  require("./definitions/onVoteRequestUpdate");


// our stuff, uncomment when ready!
exports.onInstanceCreate = onInstanceCreate.onInstanceCreate;
exports.onMessageUpdate = onMessageUpdate.onMessageUpdate;
exports.webhookHandler = webhookHandler.webhookHandler;
exports.onVoteRequestUpdate = onVoteRequestUpdate.onVoteRequestUpdate;
