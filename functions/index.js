const onInstanceCreate =
  require("./definitions/onInstanceCreate");
const onMessageUpdate =
  require("./definitions/onMessageUpdate");
const webhookHandler =
  require("./definitions/webhookHandler");
const onVoteRequestUpdate =
  require("./definitions/onVoteRequestUpdate");
const analyticsUpdateSheet =
  require("./definitions/analyticsUpdateSheet");

// our stuff, uncomment when ready!
exports.onInstanceCreate = onInstanceCreate.onInstanceCreate;
exports.onMessageUpdate = onMessageUpdate.onMessageUpdate;
exports.webhookHandler = webhookHandler.webhookHandler;
exports.onVoteRequestUpdate = onVoteRequestUpdate.onVoteRequestUpdate;
exports.analyticsUpdateSheet = analyticsUpdateSheet.analyticsUpdateSheet;
exports.analyticsUpdateSheet1 = analyticsUpdateSheet.analyticsUpdateSheet1;