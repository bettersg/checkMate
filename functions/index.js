const demoAddMessage = require('./definitions/demoAddMessage');
const demoMakeUppercase = require('./definitions/demoMakeUppercase');
const dbUpdateHanderInstanceCount = require('./definitions/dbUpdateHandlerInstanceCount');
const dbUpdateHanderVoteCount = require('./definitions/dbUpdateHandlerVoteCount');
const webhookHandlerFactChecker = require('./definitions/webhookHandlerFactChecker');
const webhookHandlerUser = require('./definitions/webhookHandlerUser');

//demo only
exports.addMessage = demoAddMessage.addMessage;
exports.makeUppercase = demoMakeUppercase.makeUppercase;

//our stuff, uncomment when ready!
//exports.launchVote = dbUpdateHanderInstanceCount.launchVote;
//exports.sendResponse = dbUpdateHanderVoteCount.sendResponse;
//exports.webhookHandlerFactChecker = webhookHandlerFactChecker.webhookHandlerFactChecker;
//exports.webhookHandlerUser = webhookHandlerUser.webhookHandlerUser;
