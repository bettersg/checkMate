import axios from "axios"
import urlRegexSafe from "url-regex-safe"

const VIRUSTOTAL_BASE_URL = "https://www.virustotal.com/api/v3"
const MAX_URLS_PER_SUBMISSION = 2
const MALICIOUS_ENGINE_THRESHOLD = 3
const ANALYSIS_POLL_ATTEMPTS = 3
const ANALYSIS_POLL_DELAY_MS = 1000

export type VirusTotalStats = {
  malicious: number
  suspicious: number
  harmless: number
  undetected: number
}

export type VirusTotalUrlScanResult = {
  url: string
  status: "completed" | "pending" | "failed"
  analysisId: string | null
  stats: VirusTotalStats | null
  /** The VirusTotal analysis response, kept for checker context and auditing. */
  response: Record<string, unknown> | null
  scannedAt: Date
}

export type VirusTotalConsentStatus =
  | "pending"
  | "processing"
  | "accepted"
  | "declined"

export function isVirusTotalScanningEnabled(): boolean {
  return (
    process.env.VIRUS_TOTAL_URL_SCANNING_ENABLED === "true" &&
    process.env.VIRUS_TOTAL_TERMS_APPROVED === "true" &&
    !!process.env.VIRUS_TOTAL_API_KEY
  )
}

export function shouldRequestVirusTotalConsent(
  text: string | null | undefined
): boolean {
  return isVirusTotalScanningEnabled() && extractUrls(text).length > 0
}

/** Extract distinct HTTP(S) URLs without removing their paths or query strings. */
export function extractUrls(text: string | null | undefined): string[] {
  if (!text) return []

  const candidates = text.match(urlRegexSafe()) ?? []
  const urls = new Set<string>()
  for (const candidate of candidates) {
    const trimmed = candidate
      .trim()
      .replace(/[.,!?;:'"<>]+$/g, "")
      .replace(/[)\]}]+$/g, "")
    try {
      const parsed = new URL(trimmed)
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        urls.add(trimmed)
      }
    } catch (_error) {
      // Ignore URL-like text that does not parse as an absolute URL.
    }
  }
  return Array.from(urls)
}

/**
 * Submit URLs to VirusTotal only after explicit per-submission consent and
 * owner-approved service configuration.
 * VirusTotal says both submitted and queried indicators enter its community
 * dataset, so the default remains off until the owner enables this integration.
 */
export async function scanUrlsWithVirusTotal(
  text: string | null | undefined,
  consented: boolean
): Promise<VirusTotalUrlScanResult[]> {
  if (!consented || !isVirusTotalScanningEnabled()) return []

  const apiKey = process.env.VIRUS_TOTAL_API_KEY
  if (!apiKey) return []

  const urls = extractUrls(text).slice(0, MAX_URLS_PER_SUBMISSION)
  const results: VirusTotalUrlScanResult[] = []

  // Keep requests sequential because VirusTotal's public API has a low default
  // request quota. Errors are recorded per URL and do not block message review.
  for (const url of urls) {
    const scannedAt = new Date()
    let analysisId: string | null = null
    let submissionResponse: Record<string, unknown> | null = null
    try {
      const submission = await axios.post(
        `${VIRUSTOTAL_BASE_URL}/urls`,
        new URLSearchParams({ url }),
        {
          headers: {
            accept: "application/json",
            "content-type": "application/x-www-form-urlencoded",
            "x-apikey": apiKey,
          },
          timeout: 15000,
        }
      )
      submissionResponse = submission.data ?? null

      const responseAnalysisId = submission.data?.data?.id
      analysisId =
        typeof responseAnalysisId === "string" ? responseAnalysisId : null
      if (!analysisId) {
        results.push({
          url,
          status: "failed",
          analysisId: null,
          stats: null,
          response: { submission: submissionResponse },
          scannedAt,
        })
        continue
      }

      let analysis
      for (let attempt = 0; attempt < ANALYSIS_POLL_ATTEMPTS; attempt++) {
        analysis = await axios.get(
          `${VIRUSTOTAL_BASE_URL}/analyses/${encodeURIComponent(analysisId)}`,
          {
            headers: {
              accept: "application/json",
              "x-apikey": apiKey,
            },
            timeout: 15000,
          }
        )
        if (
          analysis.data?.data?.attributes?.status === "completed" ||
          attempt === ANALYSIS_POLL_ATTEMPTS - 1
        ) {
          break
        }
        await new Promise((resolve) =>
          setTimeout(resolve, ANALYSIS_POLL_DELAY_MS)
        )
      }
      const attributes = analysis?.data?.data?.attributes
      const rawStats = attributes?.stats
      const stats = rawStats
        ? {
            malicious: Number(rawStats.malicious) || 0,
            suspicious: Number(rawStats.suspicious) || 0,
            harmless: Number(rawStats.harmless) || 0,
            undetected: Number(rawStats.undetected) || 0,
          }
        : null

      results.push({
        url,
        status: attributes?.status === "completed" ? "completed" : "pending",
        analysisId,
        stats,
        response: {
          submission: submissionResponse,
          analysis: analysis?.data ?? null,
        },
        scannedAt,
      })
    } catch (_error) {
      // Do not log the URL, API key, or request error; submissions can contain
      // sensitive information and the original message remains available to reviewers.
      results.push({
        url,
        status: "failed",
        analysisId,
        stats: null,
        response: submissionResponse
          ? { submission: submissionResponse }
          : null,
        scannedAt,
      })
    }
  }

  return results
}

/** Map a clear VirusTotal result to CheckMate's existing scam category. */
export function getVirusTotalCategory(
  results: VirusTotalUrlScanResult[]
): "scam" | null {
  return results.some(
    ({ status, stats }) =>
      status === "completed" &&
      stats !== null &&
      stats.malicious >= MALICIOUS_ENGINE_THRESHOLD &&
      stats.malicious > stats.harmless
  )
    ? "scam"
    : null
}
