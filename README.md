# Firebase-Functions

## First Time Setup

1. `git clone https://github.com/CheckMateSG/checkMate.git`
2. `cd checkMate`
3. `npm install -g firebase-tools`
4. `npm run postinstall`
5. run `firebase login --no-localhost` then login with your betterSG email
6. set up tunnel to localhost. Can contact BW for cloudflare tunnel

## Each Time Developing

1. Open 3 shells from in root directory
2. [Shell 1] `cd functions`
3. [Shell 1] `npm run build:watch` [hot reload for functions]
4. [Shell 2] `cd checkers-app` [hot reload for webapp]
5. [Shell 2] `npm run build:watch`
6. [Shell 3] `npm run serve`
7. Can start on development

## Useful Resources and links:

- Firebase Console - https://console.firebase.google.com/, login with your bettersg email. Go here to manage the product resources and to change the production DB (later on, for a start we can just use the emulator)
- Adding subcollections - https://stackoverflow.com/questions/47514419/how-to-add-subcollection-to-a-document-in-firebase-cloud-firestore
- Getting started with firestore and firebase (basically I've adapted that for this repo) https://firebase.google.com/docs/functions/get-started
- WhatsApp send message API documentation - https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
- WhatsApp webhook object documentation - https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
- Telegram Bot API documentation - https://core.telegram.org/bots/api
