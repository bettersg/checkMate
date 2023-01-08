/*
Assigned: Yong En

NOTES:

On update to any messages instance count:

1. if instance count above thresholdToStartVote in system_parameters collection
    1. Loop through fact checkers in the factCheckers collection
        1. if factCheckers are active
            1. send them telegram message with inline keyboard with callback buttons for voting

*/

// exports.launchVote = functions.firestore.document('/messages/{messageId}')
//   .onWrite((snap, context) => {
//     // change this
//   });