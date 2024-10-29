import { replaceTemplatePlaceholders } from "../../src/utils/messageUtils"

describe("messageUtils - replaceTemplatePlaceholders", () => {
  it("should replace placeholders with values", () => {
    const templateText = "Hello {{name}}, how are you?"
    const params = { name: "John Doe" }
    const message = replaceTemplatePlaceholders(templateText, params)
    expect(message).toBe("Hello John Doe, how are you?")
  })

  it("should replace multiple placeholders with values", () => {
    const templateText = "Hello {{name}}, how are you? I am {{age}} years old."
    const params = { name: "John Doe", age: 30 }
    const message = replaceTemplatePlaceholders(templateText, params)
    expect(message).toBe("Hello John Doe, how are you? I am 30 years old.")
  })

  it("should replace multiple of the same placeholders with values", () => {
    const templateText = "Hello {{name}}, how are you? {{name}} is a nice name."
    const params = { name: "John Doe" }
    const message = replaceTemplatePlaceholders(templateText, params)
    expect(message).toBe(
      "Hello John Doe, how are you? John Doe is a nice name."
    )
  })

  it("should work when there are no placeholders even if placeholders are passed in", () => {
    const templateText = "Hello, how are you?"
    const params = {}
    const message = replaceTemplatePlaceholders(templateText, params)
    expect(message).toBe("Hello, how are you?")
  })

  it("should warn when there are placeholders in the template but not in the params", () => {
    const templateText = "Hello {{name}}, how are you?"
    const params = {}
    const message = replaceTemplatePlaceholders(templateText, params)
    expect(message).toBe("Hello {{name}}, how are you?")
  })
})
