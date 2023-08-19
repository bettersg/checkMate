import { firestoreTimestampToYYYYMM, stripUrl, stripPhone } from "./utils"
import { Timestamp } from "firebase-admin/firestore"

describe("firestoreTimestampToYYYYMM should work correctly", () => {
  it("should convert dates properly", async () => {
    let date = new Date("2023-02-28")
    let timestamp = new Timestamp(date.getTime() / 1000, 0)
    expect(firestoreTimestampToYYYYMM(timestamp)).toBe("202302")
  })
})

describe("stripUrl should strip URLs correctly", () => {
  test("should strip standalone URLs", () => {
    const standaloneUrls = [
      { input: "http://example.com", expected: "" },
      { input: "https://secure.example.com", expected: "" },
      { input: "https://www.tiktok.com/@user/video/123456789", expected: "" },
      { input: "https://vm.tiktok.com/ZMe5TP9k8/", expected: "" },
      { input: "https://instagram.com/p/ABCDEFGH", expected: "" },
    ]

    for (const url of standaloneUrls) {
      expect(stripUrl(url.input)).toBe(url.expected)
    }
  })

  test("should strip URLs from sentences", () => {
    const sentencesWithUrls = [
      {
        input: "Visit our site at http://example.com for more info.",
        expected: "Visit our site at  for more info.",
      },
      {
        input:
          "Check this TikTok out: https://www.tiktok.com/@user/video/123456789!",
        expected: "Check this TikTok out: ",
      },
      {
        input: "Short TikTok link: https://vm.tiktok.com/ZMe5TP9k8/ is here.",
        expected: "Short TikTok link:  is here.",
      },
      {
        input: "See the post at https://instagram.com/p/ABCDEFGH.",
        expected: "See the post at ",
      },
      { input: "No URLs here.", expected: "No URLs here." },
    ]

    for (const data of sentencesWithUrls) {
      expect(stripUrl(data.input)).toBe(data.expected)
    }
  })

  test("should replace URLs with placeholder if includePlaceholder is true", () => {
    const urlWithPlaceholder = [
      { input: "http://example.com", expected: "<URL>" },
      {
        input:
          "Go to https://www.tiktok.com/@user/video/123456789 for the video.",
        expected: "Go to <URL> for the video.",
      },
      {
        input: "This is a short link: https://vm.tiktok.com/ZMe5TP9k8/.",
        expected: "This is a short link: <URL>",
      },
    ]

    for (const data of urlWithPlaceholder) {
      expect(stripUrl(data.input, true)).toBe(data.expected)
    }
  })
})
