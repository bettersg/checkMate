const onInstanceCreate =
  require("./definitions/onInstanceCreate");
const onMessageCreate =
  require("./definitions/onMessageCreate");
const onMessageUpdate =
  require("./definitions/onMessageUpdate");
const webhookHandlerFactChecker =
  require("./definitions/webhookHandlerFactChecker");
const webhookHandlerUser =
  require("./definitions/webhookHandlerUser");
const onVoteCreate =
  require("./definitions/onVoteCreate");
const onVoteRequestUpdate =
  require("./definitions/onVoteRequestUpdate");


// our stuff, uncomment when ready!
exports.onInstanceCreate = onInstanceCreate.onInstanceCreate;
exports.onMessageCreate = onMessageCreate.onMessageCreate;
exports.onVoteCreate = onVoteCreate.onVoteCreate;
exports.onMessageUpdate = onMessageUpdate.onMessageUpdate;
exports.webhookHandlerFactChecker = webhookHandlerFactChecker.webhookHandlerFactChecker;
exports.webhookHandlerUser = webhookHandlerUser.webhookHandlerUser;
exports.onVoteRequestUpdate = onVoteRequestUpdate;
