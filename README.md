# Firebase-Functions

## Development Setup

1. Git Clone (use SSH)
2. `cd firebase-functions`
3. `npm install -g firebase-tools`
4. `npm install`
5. run `firebase login` then login with your betterSG email
6. run `firebase emulators:start`
7. you should now be able to hit the url at http://127.0.0.1:5001/checkmate-373101/asia-southeast1/addMessage?text=uppercaseme successfully
8. Now can work on your individual functions in the /functions/definitions folder
9. Uncomment the exports when ready to test with the local emulator!
10. Rmb to use https://ngrok.com/ (can install vs code extension) to expose localhost as an internet URL, in case you want to run locally but test with actual Whatsapp and Telegram

## Things to note
1. Always refer to https://www.notion.so/better/Technical-Documentation-6ddc93791fdb43ff974adf7b3a7b6b3b and follow the DB schema. If you'd like to make changes to the schema, feel free! But we should let each other know on the Telegram chat, before making the change to the notion, so everyone is on the same page! It's super important to follow the schema, because that's the core of the system.
2. Test locally first using the emulator and ngrok. Once the functions are ready, we will deploy the whole setup to the production firestore.
3. Do add comments if needed, and try and write code that's easily understandable
4. Feel free to do things differently from what I've laid out (for example, you can tweak the schema), so long it makes sense! But do let us know if you are making schema changes.
5. I suggest using postman to make things like firing the API to update Telegram bot webhook repeatable (you'll have to do this cos the ngrok URL will change each time)
6. If there's anything you're unsure or stuck on, just ask in the chat :) better to unblock early than to bang the wall!

## Useful Resources and links:
- Firebase Console - https://console.firebase.google.com/, login with your bettersg email. Go here to manage the product resources and to change the production DB (later on, for a start we can just use the emulator)
- Adding subcollections - https://stackoverflow.com/questions/47514419/how-to-add-subcollection-to-a-document-in-firebase-cloud-firestore
- Getting started with firestore and firebase (basically I've adapted that for this repo) https://firebase.google.com/docs/functions/get-started
