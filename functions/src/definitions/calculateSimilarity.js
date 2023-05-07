const admin = require("firebase-admin")
const {
  textCosineSimilarity,
  getSimilarityScore,
} = require("./common/cosineSimilarityUtils")
const { stripPhone, stripUrl } = require("./common/utils")

if (!admin.apps.length) {
  admin.initializeApp()
}

exports.calculateSimilarity = async function (messageToCompare) {
  const db = admin.firestore()
  // stores the results of the comparison between each message in db and the current message to evaluate
  let comparisonScoresTable = []
  let currentSimilarityScore = 0
  // get all the messages of type text from firestore
  const spamMessages = await db
    .collection("messages")
    .where("type", "==", "text")
    .where("assessmentExpired", "==", false)
    .get()
  // iterate over the messages and compare with current then add to the table for further sorting
  spamMessages.forEach((spamMessageDoc) => {
    const spamMessage = spamMessageDoc.data()
    if (!("strippedText" in spamMessage)) {
      spamMessage.strippedText = stripPhone(spamMessage.text)
    }
    if (spamMessage.strippedText != "") {
      // if we have a match after stripping we give 100% score as it is a variation, otherwise we compute the cosineSimilarity score
      if (spamMessage.strippedText == messageToCompare) {
        comparisonScoresTable.push({
          ref: spamMessageDoc.ref,
          message: spamMessage.strippedText,
          score: 100,
        })
      } else {
        currentSimilarityScore = getSimilarityScore(
          textCosineSimilarity(spamMessage.strippedText, messageToCompare)
        )
        comparisonScoresTable.push({
          ref: spamMessageDoc.ref,
          message: spamMessage.strippedText,
          score: currentSimilarityScore,
        })
      }
    }
  })

  // sort by similarity score and return only the highest scoring message
  if (comparisonScoresTable.length > 0) {
    let sortedResults = comparisonScoresTable.sort((r1, r2) =>
      r1.score > r2.score ? 1 : r1.score < r2.score ? -1 : 0
    ) //I suspect this is yielding ascending similarity
    return sortedResults[sortedResults.length - 1]
  } else {
    return {}
  }
}
