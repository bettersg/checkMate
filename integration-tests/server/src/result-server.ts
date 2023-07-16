import express from "express"
import bodyParser from "body-parser"

const app = express()
app.use(bodyParser.json())

const port = 12345

const resultdata: any[] = []

app.all("/testresultdata", (req, res) => {
  const result = resultdata.shift()
  res.send(result)
})

app.all("/*", (req, res) => {
  if (req.body && req.body.status == "read") {
    res.send("Hello World!")
    return
  }
  resultdata.push({
    hostname: req.hostname,
    path: req.path,
    body: req.body,
    method: req.method,
  })
  res.send({
    messages: [
      {
        id: "wamid.HBgKNjU5Njg4MDMyMBUCABIYIEY4MDAwNTlEODQyMDZDMkNDOEU1NEVEQjc1MTNCMjlFAA==",
      },
    ],
  })
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
