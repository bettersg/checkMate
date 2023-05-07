import { classifyText } from "./classifier"

describe("classifyText should do correct classification", () => {
  it("should be null for >=15 chars", () => {
    expect(classifyText("123451234512345")).toBe(null)
    expect(classifyText("1234512345123451")).toBe(null)
  })
  it("should be irrelevant for <15 chars", () => {
    expect(classifyText("12345123451234")).toBe("irrelevant")
  })
})
