import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import express from "express"
import { validateFirebaseIdToken } from "./middleware/validator"
import { onRequest } from "firebase-functions/v2/https"

if (!admin.apps.length) {
  admin.initializeApp()
}

const app = express()
app.use(validateFirebaseIdToken) //TODO: uncomment if you want to turn off validation

app.get("/helloworld", (req, res) => {
  res.send({ hello: "hello from /helloworld" })
})

app.get("/voteRequest", (req, res) => {
  //TODO TONGYING: To implement
  res.sendStatus(200)
})

app.post("/voteRequest", (req, res) => {
  //TODO TONGYING: To implement, probably when they vote here
  res.sendStatus(200)
})

app.get("/checkerData", (req, res) => {
  //TODO TONGYING: To implement
  res.sendStatus(200)
})

//TODO TONGYING: decide other routes and implement

const main = express()
main.use("/api", app)

const apiHandler = onRequest(
  {
    secrets: ["TELEGRAM_BOT_TOKEN"],
  },
  main
)

export { apiHandler }
