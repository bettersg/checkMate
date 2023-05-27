import { classifyText } from "./classifier"

describe("classifyText should do correct classification", () => {
  it("should be irrelevant for <15 chars", () => {
    expect(classifyText("12345123451234")).toBe("irrelevant")
  })
})
