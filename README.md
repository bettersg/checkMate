# Firebase-Functions

## Development Setup

1. Git Clone (use SSH)
2. Go to develop branch
3. `cd firebase-functions`
4. `npm install -g firebase-tools`
5. `npm install`
6. run `firebase login` then login with your betterSG email
7. run `firebase emulators:start`
8. you should now be able to hit the url at http://127.0.0.1:5001/checkmate-373101/asia-southeast1/addMessage?text=uppercaseme successfully
9.  Now can work on your individual functions in the /functions/definitions folder
10. Uncomment the exports when ready to test with the local emulator!
11. Rmb to use https://ngrok.com/ (can install vs code extension) to expose localhost as an internet URL, in case you want to run locally but test with actual Whatsapp and Telegram

## Things to note
1. Put all keys and access tokens in the .env file and make sure its gitignored!
2. Always refer to https://www.notion.so/better/Technical-Documentation-6ddc93791fdb43ff974adf7b3a7b6b3b and follow the DB schema. If you'd like to make changes to the schema, feel free! But we should let each other know on the Telegram chat, before making the change to the notion, so everyone is on the same page! It's super important to follow the schema, because that's the core of the system.
3. Test locally first using the emulator and ngrok. Once the functions are ready, we will deploy the whole setup to the production firestore.
4. Do add comments if needed, and try and write code that's easily understandable
5. Feel free to do things differently from what I've laid out (for example, you can tweak the schema), so long it makes sense! But do let us know if you are making schema changes.
6. I suggest using postman to make things like firing the API to update Telegram bot webhook repeatable (you'll have to do this cos the ngrok URL will change each time)
7. If there's anything you're unsure or stuck on, just ask in the chat :) better to unblock early than to bang the wall!
8. For telegram we should be using webhooks, not getUpdates https://core.telegram.org/bots/api#getting-updates
9.  For telegram voting, I was thinking of using the inline keyboard with callback buttons https://core.telegram.org/bots/2-0-intro#new-inline-keyboards

## Useful Resources and links:
- Firebase Console - https://console.firebase.google.com/, login with your bettersg email. Go here to manage the product resources and to change the production DB (later on, for a start we can just use the emulator)
- Adding subcollections - https://stackoverflow.com/questions/47514419/how-to-add-subcollection-to-a-document-in-firebase-cloud-firestore
- Getting started with firestore and firebase (basically I've adapted that for this repo) https://firebase.google.com/docs/functions/get-started
- WhatsApp send message API documentation - https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
- WhatsApp webhook object documentation - https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
- Telegram Bot API documentation - https://core.telegram.org/bots/api
