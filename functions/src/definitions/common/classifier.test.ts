import { classifyText } from "./classifier"

describe("classifyText should do correct classification", () => {
  it("should be irrelevant for <8 chars", async () => {
    expect(await classifyText("1234567")).toBe("irrelevant_length")
  })
})
