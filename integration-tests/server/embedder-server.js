const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const port = 12344;

const resultdata = [];

app.all('/testresultdata', (req, res) => {
  const result = resultdata.pop();
  res.send(result);
});

app.all('/*', (req, res) => {
  resultdata.push({
    hostname: req.hostname,
    path: req.path,
    body: req.body,
    method: req.method,
  });
  res.json({ embedding: 'embedder' });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
