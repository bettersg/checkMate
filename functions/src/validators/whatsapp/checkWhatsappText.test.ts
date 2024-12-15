import { checkTemplate, stripTemplate } from "./checkWhatsappText"

describe("CheckTemplate should work correctly", () => {
  it("should match if the message matches the first template", () => {
    const template = `Referral Code/推荐码: {{code}}

按发送按钮/Click the send button to get started!👉`
    const message = `Referral Code/推荐码: FmP1zPHca

按发送按钮/Click the send button to get started!👉`

    expect(checkTemplate(message, template)).toBe(true)
  })

  it("should match if the message matches the second template", () => {
    const template = `S/N: {{code}}

Simply send this message to get started! (按发送按钮!) 👉`
    const message = `S/N: 031jFpSWu

Simply send this message to get started! (按发送按钮!) 👉`

    expect(checkTemplate(message, template)).toBe(true)
  })

  it("should not match if the message doesn't match the second template", () => {
    const template = `S/N: {{code}}

Simply send this message to get started! (按发送按钮!) 👉`
    const message = `S/N: 031jFpSWu

Simply send this messages to get started! (按发送按钮!) 👉`

    expect(checkTemplate(message, template)).toBe(false)
  })
})

describe("StripTemplate should work correctly", () => {
  const template1 = `Referral Code/推荐码: {{code}}

按发送按钮/Click the send button to get started!👉`

  const template2 = `S/N: {{code}}

Simply send this message to get started! (按发送按钮!) 👉`

  it("should remove the first template completely", () => {
    const message = `Referral Code/推荐码: FmP1zPHca

按发送按钮/Click the send button to get started!👉`
    expect(stripTemplate(message, template1)).toBe("")
  })

  it("should remove the second template completely", () => {
    const message = `S/N: 031jFpSWu

Simply send this message to get started! (按发送按钮!) 👉`
    expect(stripTemplate(message, template2)).toBe("")
  })

  it("should preserve text after the first template", () => {
    const message = `Referral Code/推荐码: FmP1zPHca

按发送按钮/Click the send button to get started!👉 Hello there!`
    expect(stripTemplate(message, template1)).toBe("Hello there!")
  })

  it("should preserve text before and after the first template", () => {
    const message = `Start text Referral Code/推荐码: FmP1zPHca

按发送按钮/Click the send button to get started!👉 End text`
    expect(stripTemplate(message, template1)).toBe("Start text  End text")
  })

  it("should handle multiple template occurrences", () => {
    const message = `Referral Code/推荐码: ABC123

按发送按钮/Click the send button to get started!👉
Middle text
Referral Code/推荐码: XYZ789

按发送按钮/Click the send button to get started!👉`
    expect(stripTemplate(message, template1)).toBe("Middle text")
  })

  it("should return original text if no template match", () => {
    const message = "Just a normal message"
    expect(stripTemplate(message, template1)).toBe("Just a normal message")
  })

  it("should handle empty message", () => {
    expect(stripTemplate("", template1)).toBe("")
  })

  it("should preserve formatting in surrounding text", () => {
    const message = `Before\nReferral Code/推荐码: FmP1zPHca

按发送按钮/Click the send button to get started!👉\nAfter`
    expect(stripTemplate(message, template1)).toBe("Before\n\nAfter")
  })

  it("should handle partial template matches without removing them", () => {
    const message = "Referral Code/推荐码: ABC123 incomplete template"
    expect(stripTemplate(message, template1)).toBe(
      "Referral Code/推荐码: ABC123 incomplete template"
    )
  })
})
