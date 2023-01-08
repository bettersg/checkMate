/*

Assigned: Elston

NOTES:

When a user sends in a msg to the fake news bot in whatsapp
    1. compare the incoming message to the existing messages in the messages collection
    2. if there is a match
        1. Add to the respective instance subcollection
    3. if no match
        1. Create new message in the messages collection and add first instance (and increment instance count)
        2. if it’s an image
            1. Download the image from whatsapp servers and put it in our cloud store
            2. Update the URL in message object

RESOURCES:

combine express with functions - https://firebase.google.com/docs/functions/http-events#using_existing_express_apps

*/

// exports.webhookHandlerUser = functions.https.onRequest(async (req, res) => {
//     //to be done
// });