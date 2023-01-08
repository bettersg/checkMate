/*
Assigned: Yong En

NOTES:

Needs to handle 3 scenarios, all of which hit the same http webhook handler:

1. fact_checkers signup (rmb to handle duplicates, cos factCheckers can just type that message again)
  a. Get the details needed to populate the user object
  b. Create fact_checker in factCheckers collection

2. Voting on new message (inline keyboard callback button handler for telegram )
  a. Add votes to votes subcollection
  b. Increment vote count

3. Replies to new message with verification link url
  a. Check if its a link to official news agencies (we may have to create a whitelist of cna etc)
  b. If yes
    i. Update verification links subcollection (fact checkers array and count)

RESOURCES:

combine express with functions - https://firebase.google.com/docs/functions/http-events#using_existing_express_apps

*/

// exports.webhookHandlerFactChecker = functions.https.onRequest(async (req, res) => {
//   //to be done
// });