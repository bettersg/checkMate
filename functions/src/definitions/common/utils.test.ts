import {
  firestoreTimestampToYYYYMM,
  stripUrl,
  stripPhone,
  checkTemplate,
} from "./utils"
import { Timestamp } from "firebase-admin/firestore"

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

describe("firestoreTimestampToYYYYMM should work correctly", () => {
  it("should convert dates properly", async () => {
    let date = new Date("2023-02-28")
    let timestamp = new Timestamp(date.getTime() / 1000, 0)
    expect(firestoreTimestampToYYYYMM(timestamp)).toBe("202302")
  })
})

// Test strings are messages from actual Firestore. Phone numbers jumbled for anonymity.
describe("stripPhone function", () => {
  describe("when text contains a valid phone number to be extracted", () => {
    describe("when includePlaceholder is set to false", () => {
      it("should strip phone numbers from the original string", () => {
        const testCases = [
          { originalStr: "Phone call: 83294023", expectedStr: "Phone call: " },
          {
            originalStr:
              "https://youtu.be/oglCjESHJ70?si=JznEryFFXUZ6y2ma ~Dayan +6583294023 Who are you ~SLTan米+6583294023 你是红桂桥Ada？ ~Dayan +6583294023 No",
            expectedStr:
              "https://youtu.be/oglCjESHJ70?si=JznEryFFXUZ6y2ma ~Dayan  Who are you ~SLTan米 你是红桂桥Ada？ ~Dayan  No",
          },
        ]

        testCases.forEach(({ originalStr, expectedStr }) => {
          expect(stripPhone(originalStr)).toEqual(expectedStr)
        })
      })
    }),
      describe("when includePlaceholder is set to true", () => {
        it("should replace phone numbers with placeholder from the original string", () => {
          const testCases = [
            {
              originalStr: "Phone call: 83294023",
              expectedStr: "Phone call: <PHONE_NUM>",
            },
            {
              originalStr:
                "https://youtu.be/oglCjESHJ70?si=JznEryFFXUZ6y2ma ~Dayan +6588888888 Who are you ~SLTan米+6599999999 你是红桂桥Ada？ ~Dayan +6589898989 No",
              expectedStr:
                "https://youtu.be/oglCjESHJ70?si=JznEryFFXUZ6y2ma ~Dayan <PHONE_NUM> Who are you ~SLTan米<PHONE_NUM> 你是红桂桥Ada？ ~Dayan <PHONE_NUM> No",
            },
            {
              originalStr: "you ~SLTan米+6583294023",
              expectedStr: "you ~SLTan米<PHONE_NUM>",
            },
          ]
          testCases.forEach(({ originalStr, expectedStr }) => {
            expect(stripPhone(originalStr, true)).toEqual(expectedStr)
          })
        })
      })
  }),
    describe("when text does not contain a valid phone number", () => {
      it("should return the original string", () => {
        const testCases = [
          {
            originalStr:
              "Here are some signs that this message is a scam: 1) The message claims that a delivery failed and that goods have been returned to a collection center, but it does not provide any specific details about the delivery or the goods in question. 2) The message includes a shortened URL (https://goo.su/PTvJGC), which could potentially lead to a malicious website or phishing attempt. 3) The message creates a sense of urgency by asking the recipient to schedule a new delivery immediately, which could be a tactic to pressure the recipient into clicking the link without thinking critically about its legitimacy.",
            expectedStr:
              "Here are some signs that this message is a scam: 1) The message claims that a delivery failed and that goods have been returned to a collection center, but it does not provide any specific details about the delivery or the goods in question. 2) The message includes a shortened URL (https://goo.su/PTvJGC), which could potentially lead to a malicious website or phishing attempt. 3) The message creates a sense of urgency by asking the recipient to schedule a new delivery immediately, which could be a tactic to pressure the recipient into clicking the link without thinking critically about its legitimacy.",
          },
          {
            originalStr:
              "https://www.instagram.com/reel/CvsSNvzJH38/?igshid=MzRlODBiNWFlZA== is this for real?",
            expectedStr:
              "https://www.instagram.com/reel/CvsSNvzJH38/?igshid=MzRlODBiNWFlZA== is this for real?",
          },
        ]
        testCases.forEach(({ originalStr, expectedStr }) => {
          expect(stripPhone(originalStr)).toEqual(expectedStr)
        })
      })
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
