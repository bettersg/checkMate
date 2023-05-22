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
  // get all the messages of type text from firestore
  const instances = await db
    .collectionGroup("instances")
    .where("type", "==", "text")
    .get()

  const results = await Promise.all(instances.docs.map(async (instance) => {
    const instanceDoc = instance.data()
    let currentSimilarityScore = 0

    if (!("strippedText" in instanceDoc)) {
      instanceDoc.strippedText = stripPhone(instanceDoc.text)
    }

    const parentMessage = await instance.ref.parent.parent.get();
    if (!parentMessage || parentMessage.get("assessmentExpired")) {
      return null;
    }

    if (instanceDoc.strippedText != "") {
      if (instanceDoc.strippedText == messageToCompare) {
        return {
          ref: instance.ref,
          message: instanceDoc.strippedText,
          parent: parentMessage.ref,
          score: 1.0,
        }
      } else {
        currentSimilarityScore = getSimilarityScore(
          textCosineSimilarity(instanceDoc.strippedText, messageToCompare)
        )
        return {
          ref: instance.ref,
          message: instanceDoc.strippedText,
          parent: parentMessage.ref,
          score: currentSimilarityScore,
        }
      }
    }
    return null;
  }))

  // Filter out null results and add them to the comparisonScoresTable
  comparisonScoresTable = results.filter(result => result != null);

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
