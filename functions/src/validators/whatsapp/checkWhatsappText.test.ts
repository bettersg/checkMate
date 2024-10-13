import { checkTemplate } from "./checkWhatsappText"

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
