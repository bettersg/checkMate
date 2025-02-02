import { getShuffledDocsFromSnapshot } from "../../src/utils/shuffleUtils"

import * as admin from "firebase-admin"

describe("getShuffledDocsFromSnapshot", () => {
  const createMockDoc = (
    id: string,
    countValue: number
  ): admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData> => {
    return {
      id,
      get: (key: string) => (key === "count" ? countValue : null),
      data: () => ({ count: countValue }),
      ref: {} as admin.firestore.DocumentReference<admin.firestore.DocumentData>, // Mock reference
      exists: true,
      createTime: {} as admin.firestore.Timestamp, // Mock createTime
      updateTime: {} as admin.firestore.Timestamp, // Mock updateTime
      readTime: {} as admin.firestore.Timestamp, // Mock readTime
    } as unknown as admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>
  }

  it("should group by groupKey, shuffle within groups, and process groups in ascending order", () => {
    const mockDocs: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>[] =
      [
        createMockDoc("1", 0),
        createMockDoc("2", 0),
        createMockDoc("3", 1),
        createMockDoc("4", 1),
        createMockDoc("5", 2),
        createMockDoc("6", 2),
      ]

    // Call the function
    const result = getShuffledDocsFromSnapshot(mockDocs, "count", 4)

    console.log(result)

    // Assertions
    expect(result).toHaveLength(4) // Should return exactly 4 documents

    // Ensure the groups are processed in ascending order
    const counts = result.map((doc) => doc.get("count"))
    const firstGroupCount = counts[0]
    const lastGroupCount = counts[counts.length - 1]
    expect(firstGroupCount).toBeLessThanOrEqual(lastGroupCount)
  })
})
