/*

Assigned: Elston

NOTES:

When the vote count changes for any message in the database

1. Update the message truth score and isIrrelevant with the mean vote score
2. If vote count ≥ thresholdToEndVote:
    1. loop through instances in the updated message
        1. Send message to each instance where replied is false

*/

// exports.sendResponse = functions.firestore.document('/messages/{messageId}')
//     .onUpdate((snap, context) => {
//         // // Grab the current value of what was written to Firestore.
//         // const original = snap.data().original;

//         // // Access the parameter `{documentId}` with `context.params`
//         // functions.logger.log('Uppercasing', context.params.messageId, original);

//         // const uppercase = original.toUpperCase();

//         // // You must return a Promise when performing asynchronous tasks inside a Functions such as
//         // // writing to Firestore.
//         // // Setting an 'uppercase' field in Firestore document returns a Promise.
//         // return snap.ref.set({ uppercase }, { merge: true });
//     });