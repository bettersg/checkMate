import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import express from "express"
import { validateFirebaseIdToken } from "./middleware/validator"
import { onRequest } from "firebase-functions/v2/https"

if (!admin.apps.length) {
  admin.initializeApp()
}

const app = express()
app.use(validateFirebaseIdToken) //TODO: uncomment when ready to validate with Telegram App

app.get("/helloworld", (req, res) => {
  res.send("Hello World!")
})

app.get("/voteRequest", (req, res) => {
  //TODO: To implement
  res.sendStatus(200)
})

app.post("/voteRequest", (req, res) => {
  //TODO: To implement, probably when they vote here
  res.sendStatus(200)
})

app.get("/checkerData", (req, res) => {
  //TODO: To implement
  res.sendStatus(200)
})

//TODO: decide other routes and implement

const apiHandler = onRequest(
  {
    secrets: ["TELEGRAM_BOT_TOKEN"],
  },
  app
)

export { apiHandler }
