import { app } from "./handler"
import { agent } from "supertest"

process.env.VERIFY_TOKEN = "testToken"

describe("whatsapp webhook verifier", () => {
  it("should verify successfully when mode and token are appropriate", async () => {
    const request = agent(app)
    const response = await request.get(
      "/whatsapp?hub.mode=subscribe&hub.verify_token=testToken"
    )
    expect(response.status).toBe(200)
    // expect(response.body.message).toBe('pass!')
    return
  })
  it("should reject when token is invalid", async () => {
    const request = agent(app)
    const response = await request.get(
      "/whatsapp?hub.mode=subscribe&hub.verify_token=testToken1"
    )
    expect(response.status).toBe(403)
    return
  })
  it("should reject when mode is invalid", async () => {
    const request = agent(app)
    const response = await request.get(
      "/whatsapp?hub.mode=subscribed&hub.verify_token=testToken"
    )
    expect(response.status).toBe(403)
    return
  })
  it("should not work if mode and token are not present", async () => {
    const request = agent(app)
    const response = await request.get("/whatsapp")
    expect(response.status).toBe(400)
    return
  })
})
