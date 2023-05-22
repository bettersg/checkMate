import {
  textCosineSimilarity,
  getSimilarityScore,
} from "./cosineSimilarityUtils"

describe("textCosineSimilarity", () => {
  it("should should calculate correctly", () => {
    expect(textCosineSimilarity("abc", "")).toBe(0)
    expect(textCosineSimilarity("abc", "123")).toBe(0)
    expect(textCosineSimilarity("abc", "abc")).toBe(1)
    expect(textCosineSimilarity("abc test", "abc")).toBe(0.7071067811865475)
    expect(textCosineSimilarity("abc", "abc test")).toBe(0.7071067811865475)
  })
})

describe("getSimilarityScore", () => {
  it("should round correctly", () => {
    expect(getSimilarityScore(0.88204909)).toBe(0.88)
    expect(getSimilarityScore(0.32509313)).toBe(0.33)
  })
})
