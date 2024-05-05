import * as admin from "firebase-admin"
import { Timestamp } from "firebase-admin/firestore"
import { computeGamificationScore } from "./statistics"

// Function to create a mock DocumentSnapshot
function createMockDocumentSnapshot(data: any) {
  return {
    exists: true,
    isEqual: jest.fn(),
    id: "mockDocId",
    ref: {} as admin.firestore.DocumentReference,
    metadata: {}, // Metadata can be mocked as an empty object or further detailed
    readTime: Timestamp.now(),
    get: jest.fn((field) => data[field]),
    data: jest.fn(() => data),
  }
}

// Example usage in a test
describe("computeGamificationScore Tests", () => {
  it("should calculate correct score for a valid response time", () => {
    // Setup
    const nowSeconds = Math.floor(Date.now() / 1000)
    const createdTimestamp = new Timestamp(nowSeconds - 3600, 0) // 1 hour ago
    const votedTimestamp = new Timestamp(nowSeconds, 0)

    const mockData = {
      createdTimestamp: createdTimestamp,
      votedTimestamp: votedTimestamp,
    }

    const mockDocSnap = createMockDocumentSnapshot(mockData)

    // Act
    const score = computeGamificationScore(mockDocSnap, true)
    // Assert
    expect(score).toBeCloseTo(0.97916667) // Expect some positive score for correct and timely response
  })
})
