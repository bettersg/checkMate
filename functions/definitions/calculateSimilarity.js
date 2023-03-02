const admin = require("firebase-admin");
const { textCosineSimilarity, getSimilarityScore } = require("./common/cosineSimilarityUtils");

if (!admin.apps.length) {
    admin.initializeApp();
}

exports.calculateSimilarity = async function (messageToCompare) {
    const db = admin.firestore()
    // strip any url in the message
    messageToCompare = messageToCompare.replace(/(?:https?|ftp):\/\/[\n\S]+/g, '');
    // strip phone numbers of minimum 7 digits as they can vary as well
    messageToCompare = messageToCompare.replace(/[0-9]{7,}/g, '')
    
    // stores the results of the comparison between each message in db and the current message to evaluate
    let comparisonScoresTable = [] 
    let currentSimilarityScore = 0

    // get all the messages of type text from firestore
    const spamMessages = await db.collection('messages').where('type', '==', 'text').get();
    // iterate over the messages and compare with current then add to the table for further sorting
    spamMessages.forEach(spamMessageDoc =>{
        const spamMessage = spamMessageDoc.data();
        if(spamMessage.text != "") {
            // strip urls from current message to allow variation comparison
            let currentMessage = spamMessage.text.replace(/(?:https?|ftp):\/\/[\n\S]+/g, '');
            // strip phone numbers of minimum 7 digits as they can vary as well
            currentMessage = currentMessage.replace(/[0-9]{7,}+/g, '')
            // if we have a match after stripping we give 100% score as it is a variation, otherwise we compute the cosineSimilarity score
            if (currentMessage == messageToCompare) {
                comparisonScoresTable.push( {message: spamMessage.text, score: 100} )    
            } else {
                currentSimilarityScore = getSimilarityScore(textCosineSimilarity(spamMessage.text, messageToCompare))
                comparisonScoresTable.push( {message: currentMessage, score: currentSimilarityScore} )  
            }
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

