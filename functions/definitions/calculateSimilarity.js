const admin = require("firebase-admin");
const { textCosineSimilarity, getSimilarityScore } = require("./common/cosineSimilarityUtils");

if (!admin.apps.length) {
    admin.initializeApp();
}

exports.calculateSimilarity = async function (messageToCompare) {
    const db = admin.firestore()

    // stores the results of the comparison between each message in db and the current message to evaluate
    let comparisonScoresTable = [] 
    let currentSimilarityScore = 0

    // get all the messages of type text from firestore
    const spamMessages = await db.collection('messages').where('type', '==', 'text').get();
    // iterate over the messages and compare with current then add to the table for further sorting
    spamMessages.forEach(spamMessageDoc =>{
        const spamMessage = spamMessageDoc.data();
        if(spamMessage.text != "") {
            currentSimilarityScore = getSimilarityScore(textCosineSimilarity(spamMessage.text, messageToCompare))
            comparisonScoresTable.push( {message: spamMessage.text, score: currentSimilarityScore} )    
        }
    })

    // sort by similarity score and return only the highest scoring message
    if (comparisonScoresTable.length > 0) {
        let sortedResults = comparisonScoresTable.sort((r1, r2) => (r1.score > r2.score) ? 1 : (r1.score < r2.score) ? -1 : 0);
        return sortedResults[0]
    } else {
        return {}
    }
    
}

