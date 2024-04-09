Telegram web app is for assessing

# Developer onboarding for checkers-app
- Create a telegram bot via Botfather
- Configure the bot's setting
  - Bot settings
  - Menu Button
  - Menu Button url - Point to <Cloudflare URL>
  - Menu button title - "Open checkmate"
- Set up Cloudflare tunnel - Consult BingWen
  - TODO: Detail steps here
- Get `.secrets.local`, `.env`, `.env.local`, `.env.prod`, `.env.uat` from team, place in `checkMate` repo
 - Modifiy `.secrets.local` - `TELEGRAM_CHECKER_BOT_TOKEN` and `TELEGRAM_BOT_TOKEN` to token id received from botfather
- Set up telegram webhook
 - Unset any existing webhooks https://api.telegram.org/bot<TOKEN>/setWebhook?url=
 - Send a POST request to set up with secret_token 
  - Body - form-data
    - URL: <Cloudflare URL>
    - secret_token: <TELEGRAM_WEBHOOK_URL>

- Ensure on `feature/checkers-app` branch
- Start 3 separate services in checkMate repo
  - functions
    - `cd functions && npm i && npm run build:watch`
  - checkers-app
    - `cd checkers-app && npm i && npm run build:watch`
  - firebase emulators
    - `npm i && npm run serve`
- Set up mock data in firebase emulator
  - Send message `/mockdb` to CheckMate Users Testing By Better.sg bot - +65 8617 7848
  - Check that firebase store has been populated with mock data

# Sanity check
- Development flow sanity check (ensure above onboarding flows have been done)
- From WhatsApp, send the following command
 - `Check/Report
Send in messages, images, or screenshots for checking!`
 - Click the menu button > Check / Report
 - Send a dubious test messages to CheckMate Users Testing By Better.sg bot - +65 8617 7848
 - Check that telegram bot received a pending message to be checked
  - Open web app via telegram bot's menu button
  - Perform assessment
- On WA bot, receive the evaluated message