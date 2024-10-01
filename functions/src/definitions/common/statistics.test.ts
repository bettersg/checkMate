import * as admin from "firebase-admin"
import { Timestamp } from "firebase-admin/firestore"
import { computeGamificationScore, areTagsEqual } from "./statistics"

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

describe("areTagsEqual", () => {
  test("Both tags are empty objects", () => {
    const tags1 = {}
    const tags2 = {}
    expect(areTagsEqual(tags1, tags2)).toBe(true)
  })

  test("Both tags have the same keys with true values", () => {
    const tags1 = { generated: true, incorrect: true }
    const tags2 = { generated: true, incorrect: true }
    expect(areTagsEqual(tags1, tags2)).toBe(true)
  })

  test("Tags have different keys", () => {
    const tags1 = { generated: true, incorrect: true }
    const tags2 = { generated: true, correct: true }
    expect(areTagsEqual(tags1, tags2)).toBe(false)
  })

  test("One tag has additional keys with true values", () => {
    const tags1 = { generated: true, incorrect: true, extra: true }
    const tags2 = { generated: true, incorrect: true }
    expect(areTagsEqual(tags1, tags2)).toBe(false)
  })

  test("One tag has additional keys with false values", () => {
    const tags1 = { generated: true, incorrect: true, extra: false }
    const tags2 = { generated: true, incorrect: true }
    expect(areTagsEqual(tags1, tags2)).toBe(true)
  })

  test("Tags have same keys but different boolean values", () => {
    const tags1 = { generated: true, incorrect: false }
    const tags2 = { generated: true, incorrect: true }
    expect(areTagsEqual(tags1, tags2)).toBe(false)
  })

  test("Keys with false values are ignored in comparison", () => {
    const tags1 = { generated: true, incorrect: false }
    const tags2 = { generated: true }
    expect(areTagsEqual(tags1, tags2)).toBe(true)
  })

  test("Tags with all keys set to false", () => {
    const tags1 = { generated: false, incorrect: false }
    const tags2 = { generated: false, incorrect: false }
    expect(areTagsEqual(tags1, tags2)).toBe(true)
  })
})
