import express from "express"
import bodyParser from "body-parser"

const app = express()
app.use(bodyParser.json())

const port = 12344

const resultdata: any[] = []

app.all("/testresultdata", (req, res) => {
  const result = resultdata.pop()
  res.send(result)
})

app.post("/getL1Category", (req, res) => {
  if (req.body.text.toLowerCase().includes("scam")) {
    res.json({ prediction: "scam" })
  } else if (req.body.text.toLowerCase().includes("illicit")) {
    res.json({ prediction: "illicit" })
  } else if (req.body.text.toLowerCase().includes("spam")) {
    res.json({ prediction: "spam" })
  } else if (req.body.text.toLowerCase().includes("info")) {
    res.json({ prediction: "info" })
  } else if (req.body.text.toLowerCase().includes("trivial")) {
    res.json({ prediction: "trivial" })
  } else {
    res.json({ prediction: "unsure" })
  }
})

app.post("/embed", (req, res) => {
  if (req.body.text.toLowerCase().includes("scam")) {
    res.json({ embedding: new Array(384).fill(0.1) })
  } else if (req.body.text.toLowerCase().includes("illicit")) {
    res.json({ embedding: new Array(384).fill(0.3) })
  } else if (req.body.text.toLowerCase().includes("spam")) {
    res.json({ embedding: new Array(384).fill(0.5) })
  } else if (req.body.text.toLowerCase().includes("info")) {
    res.json({ embedding: new Array(384).fill(0.7) })
  } else if (req.body.text.toLowerCase().includes("trivial")) {
    res.json({ embedding: new Array(384).fill(0.9) })
  } else {
    let array = Array.from({ length: 384 }, () => Math.random())
    res.json({ embedding: array })
  }
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
