import { firestoreTimestampToYYYYMM } from "./utils"
import { Timestamp } from "firebase-admin/firestore"

describe("firestoreTimestampToYYYYMM should work correctly", () => {
  it("should convert dates properly", async () => {
    let date = new Date("2023-02-28")
    let timestamp = new Timestamp(date.getTime() / 1000, 0)
    expect(firestoreTimestampToYYYYMM(timestamp)).toBe("202302")
  })
})
