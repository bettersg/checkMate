const { FieldValue } = require("@google-cloud/firestore")

exports.incrementCounter = async function (
  docRef,
  type,
  numShards,
  increment = 1
) {
  if (!docRef) {
    return
  }
  const shardId = Math.floor(Math.random() * numShards)
  const shardRef = docRef.collection("shards").doc(shardId.toString())
  return shardRef.set(
    { [`${type}Count`]: FieldValue.increment(increment) },
    { merge: true }
  )
}

exports.getCount = async function (docRef, type) {
  const querySnapshot = await docRef.collection("shards").get()
  const documents = querySnapshot.docs
  let count = 0
  for (const doc of documents) {
    count += doc.get(`${type}Count`) ?? 0
  }
  return count
}
