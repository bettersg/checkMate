import { classifyText } from "./classifier"

describe("classifyText should do correct classification", () => {
  it("should be irrelevant for <10 chars", async () => {
    expect(await classifyText("12345678")).toBe("irrelevant_length")
  })
})
