import * as admin from "firebase-admin"

export function getShuffledDocsFromSnapshot(
  docs: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>[],
  groupKey: string,
  n: number
): admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>[] {
  // Group documents by the dynamic key
  const grouped = groupBy(docs, (doc) => doc.get(groupKey))

  // Shuffle within groups and collect results, processing groups in ascending order
  const shuffledResults: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>[] =
    []
  for (const key of Object.keys(grouped).sort(
    (a, b) => Number(a) - Number(b)
  )) {
    const group = grouped[key]
    group.sort(() => Math.random() - 0.5) // Shuffle using a random comparator
    shuffledResults.push(...group)
    if (shuffledResults.length >= n) break // Stop when we have enough items
  }

  // Return only the first n documents
  return shuffledResults.slice(0, n)
}

// Helper function: groupBy
function groupBy<T>(
  array: T[],
  keyFn: (item: T) => string
): Record<string, T[]> {
  return array.reduce((acc: Record<string, T[]>, item: T) => {
    const key = keyFn(item)
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(item)
    return acc
  }, {})
}
