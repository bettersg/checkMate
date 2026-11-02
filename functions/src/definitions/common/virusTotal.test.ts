import axios from "axios"
import userResponses from "./parameters/userResponses.json"
import {
  extractUrls,
  getVirusTotalCategory,
  scanUrlsWithVirusTotal,
  shouldRequestVirusTotalConsent,
  VirusTotalUrlScanResult,
} from "./virusTotal"

jest.mock("axios")

const mockedAxios = axios as jest.Mocked<typeof axios>
const testUrl = "https://phishing.example.com/login?token=mock-only"

describe("VirusTotal URL scanning", () => {
  const originalEnvironment = {
    enabled: process.env.VIRUS_TOTAL_URL_SCANNING_ENABLED,
    termsApproved: process.env.VIRUS_TOTAL_TERMS_APPROVED,
    apiKey: process.env.VIRUS_TOTAL_API_KEY,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.VIRUS_TOTAL_URL_SCANNING_ENABLED = "true"
    process.env.VIRUS_TOTAL_TERMS_APPROVED = "true"
    process.env.VIRUS_TOTAL_API_KEY = "mock-api-key"
  })

  afterAll(() => {
    if (originalEnvironment.enabled === undefined) {
      delete process.env.VIRUS_TOTAL_URL_SCANNING_ENABLED
    } else {
      process.env.VIRUS_TOTAL_URL_SCANNING_ENABLED = originalEnvironment.enabled
    }
    if (originalEnvironment.termsApproved === undefined) {
      delete process.env.VIRUS_TOTAL_TERMS_APPROVED
    } else {
      process.env.VIRUS_TOTAL_TERMS_APPROVED = originalEnvironment.termsApproved
    }
    if (originalEnvironment.apiKey === undefined) {
      delete process.env.VIRUS_TOTAL_API_KEY
    } else {
      process.env.VIRUS_TOTAL_API_KEY = originalEnvironment.apiKey
    }
  })

  it("extracts full distinct HTTP URLs, including paths and query strings", () => {
    expect(extractUrls(`Open ${testUrl}. Then ${testUrl}!`)).toEqual([testUrl])
  })

  it("does not prompt or make a request until all owner gates and consent are set", async () => {
    expect(shouldRequestVirusTotalConsent(testUrl)).toBe(true)
    expect(await scanUrlsWithVirusTotal(testUrl, false)).toEqual([])
    expect(mockedAxios.post).not.toHaveBeenCalled()
    expect(mockedAxios.get).not.toHaveBeenCalled()

    process.env.VIRUS_TOTAL_TERMS_APPROVED = "false"
    expect(shouldRequestVirusTotalConsent(testUrl)).toBe(false)
    expect(await scanUrlsWithVirusTotal(testUrl, true)).toEqual([])
    expect(mockedAxios.post).not.toHaveBeenCalled()
  })

  it("is off by default and without an API key", async () => {
    delete process.env.VIRUS_TOTAL_URL_SCANNING_ENABLED
    expect(shouldRequestVirusTotalConsent(testUrl)).toBe(false)
    expect(await scanUrlsWithVirusTotal(testUrl, true)).toEqual([])

    process.env.VIRUS_TOTAL_URL_SCANNING_ENABLED = "true"
    delete process.env.VIRUS_TOTAL_API_KEY
    expect(shouldRequestVirusTotalConsent(testUrl)).toBe(false)
    expect(await scanUrlsWithVirusTotal(testUrl, true)).toEqual([])
    expect(mockedAxios.post).not.toHaveBeenCalled()
    expect(mockedAxios.get).not.toHaveBeenCalled()
  })

  it("posts only after consent and stores both API responses", async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { data: { id: "analysis-mock-id" } },
    } as never)
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        data: {
          attributes: {
            status: "completed",
            stats: { malicious: 4, suspicious: 1, harmless: 2, undetected: 5 },
          },
        },
      },
    } as never)

    const result = await scanUrlsWithVirusTotal(testUrl, true)

    expect(mockedAxios.post).toHaveBeenCalledTimes(1)
    const [requestUrl, requestBody, requestOptions] =
      mockedAxios.post.mock.calls[0]
    expect(requestUrl).toBe("https://www.virustotal.com/api/v3/urls")
    expect(requestBody).toBeInstanceOf(URLSearchParams)
    expect((requestBody as URLSearchParams).get("url")).toBe(testUrl)
    expect(requestOptions?.headers).toEqual(
      expect.objectContaining({ "x-apikey": "mock-api-key" })
    )
    expect(mockedAxios.get).toHaveBeenCalledWith(
      "https://www.virustotal.com/api/v3/analyses/analysis-mock-id",
      expect.any(Object)
    )
    expect(result[0]).toMatchObject({
      url: testUrl,
      status: "completed",
      analysisId: "analysis-mock-id",
      stats: { malicious: 4, suspicious: 1, harmless: 2, undetected: 5 },
      response: {
        submission: { data: { id: "analysis-mock-id" } },
        analysis: { data: { attributes: { status: "completed" } } },
      },
    })
    expect(getVirusTotalCategory(result)).toBe("scam")
  })

  it("uses the existing scam category only for a clear completed result", () => {
    const result = (
      status: VirusTotalUrlScanResult["status"],
      malicious: number,
      harmless: number
    ): VirusTotalUrlScanResult[] => [
      {
        url: testUrl,
        status,
        analysisId: "analysis-mock-id",
        stats: { malicious, suspicious: 0, harmless, undetected: 10 },
        response: {},
        scannedAt: new Date("2026-11-03T00:00:00Z"),
      },
    ]

    expect(getVirusTotalCategory(result("pending", 8, 0))).toBeNull()
    expect(getVirusTotalCategory(result("completed", 2, 0))).toBeNull()
    expect(getVirusTotalCategory(result("completed", 4, 4))).toBeNull()
    expect(getVirusTotalCategory(result("completed", 4, 1))).toBe("scam")
  })

  it("discloses VirusTotal community sharing in English and Chinese", () => {
    expect(userResponses.VIRUSTOTAL_URL_CONSENT.en).toContain("community dataset")
    expect(userResponses.VIRUSTOTAL_URL_CONSENT.en).toContain("VirusTotal")
    expect(userResponses.VIRUSTOTAL_URL_CONSENT.cn).toContain("社区数据库")
    expect(userResponses.BUTTON_VIRUSTOTAL_PRIVATE.en).toBe("Keep private")
  })
})
