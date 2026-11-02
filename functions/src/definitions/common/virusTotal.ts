import axios from "axios"
import urlRegexSafe from "url-regex-safe"

const VIRUSTOTAL_BASE_URL = "https://www.virustotal.com/api/v3"
const MALICIOUS_ENGINE_THRESHOLD = 3
const MAX_RATE_LIMIT_RETRIES = 1

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
  /** The VirusTotal submission and analysis responses, stored for audit. */
  response: Record<string, unknown> | null
  scannedAt: Date
  retryable: boolean
  errorCode: "rate_limited" | "request_failed" | null
}

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

function responseStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return null
  }
  const status = (error as { response?: { status?: unknown } }).response?.status
  return typeof status === "number" ? status : null
}

function retryAfterMilliseconds(error: unknown): number {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return 1000
  }
  const headers = (error as { response?: { headers?: Record<string, unknown> } })
    .response?.headers
  const header = headers?.["retry-after"] ?? headers?.["Retry-After"]
  if (typeof header === "number" || typeof header === "string") {
    const seconds = Number(header)
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, 60000)
    }
    const retryDate = new Date(header).getTime()
    if (Number.isFinite(retryDate)) {
      return Math.max(1000, Math.min(retryDate - Date.now(), 60000))
    }
  }
  return 1000
}

async function requestWithRateLimitRetry<T>(request: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await request()
    } catch (error) {
      if (responseStatus(error) !== 429 || attempt >= MAX_RATE_LIMIT_RETRIES) {
        throw error
      }
      await new Promise((resolve) =>
        setTimeout(resolve, retryAfterMilliseconds(error))
      )
    }
  }
}

/** Extract every distinct HTTP(S) URL without dropping paths or query strings. */
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

function parseStats(rawStats: unknown): VirusTotalStats | null {
  if (typeof rawStats !== "object" || rawStats === null) return null
  const stats = rawStats as Record<string, unknown>
  return {
    malicious: Number(stats.malicious) || 0,
    suspicious: Number(stats.suspicious) || 0,
    harmless: Number(stats.harmless) || 0,
    undetected: Number(stats.undetected) || 0,
  }
}

async function getAnalysisResult(
  url: string,
  analysisId: string,
  submissionResponse: Record<string, unknown> | null,
  apiKey: string
): Promise<VirusTotalUrlScanResult> {
  const scannedAt = new Date()
  try {
    const analysis = await requestWithRateLimitRetry(() =>
      axios.get(
        `${VIRUSTOTAL_BASE_URL}/analyses/${encodeURIComponent(analysisId)}`,
        {
          headers: {
            accept: "application/json",
            "x-apikey": apiKey,
          },
          timeout: 15000,
        }
      )
    )
    const attributes = analysis.data?.data?.attributes
    const completed = attributes?.status === "completed"
    return {
      url,
      status: completed ? "completed" : "pending",
      analysisId,
      stats: parseStats(attributes?.stats),
      response: {
        submission: submissionResponse,
        analysis: analysis.data ?? null,
      },
      scannedAt,
      retryable: !completed,
      errorCode: null,
    }
  } catch (error) {
    const rateLimited = responseStatus(error) === 429
    return {
      url,
      status: rateLimited ? "pending" : "failed",
      analysisId,
      stats: null,
      response: submissionResponse ? { submission: submissionResponse } : null,
      scannedAt,
      retryable: rateLimited,
      errorCode: rateLimited ? "rate_limited" : "request_failed",
    }
  }
}

async function scanOneUrl(
  url: string,
  apiKey: string
): Promise<VirusTotalUrlScanResult> {
  const scannedAt = new Date()
  let submissionResponse: Record<string, unknown> | null = null
  try {
    const submission = await requestWithRateLimitRetry(() =>
      axios.post(
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
    )
    submissionResponse = submission.data ?? null
    const responseAnalysisId = submission.data?.data?.id
    if (typeof responseAnalysisId !== "string" || responseAnalysisId.length === 0) {
      return {
        url,
        status: "failed",
        analysisId: null,
        stats: null,
        response: { submission: submissionResponse },
        scannedAt,
        retryable: false,
        errorCode: "request_failed",
      }
    }

    return await getAnalysisResult(
      url,
      responseAnalysisId,
      submissionResponse,
      apiKey
    )
  } catch (error) {
    const rateLimited = responseStatus(error) === 429
    return {
      url,
      status: rateLimited ? "pending" : "failed",
      analysisId: null,
      stats: null,
      response: submissionResponse
        ? { submission: submissionResponse }
        : null,
      scannedAt,
      retryable: rateLimited,
      errorCode: rateLimited ? "rate_limited" : "request_failed",
    }
  }
}

/**
 * Submit URLs only after explicit per-submission consent and owner-approved
 * service configuration. The standard API adds submitted indicators to its
 * community dataset, so this integration is disabled unless all gates are set.
 */
export async function scanUrlsWithVirusTotal(
  text: string | null | undefined,
  consented: boolean
): Promise<VirusTotalUrlScanResult[]> {
  if (!consented || !isVirusTotalScanningEnabled()) return []

  const apiKey = process.env.VIRUS_TOTAL_API_KEY
  if (!apiKey) return []

  const urls = extractUrls(text)
  const results: VirusTotalUrlScanResult[] = []

  // Process every distinct URL sequentially. If the provider rate-limits a
  // request, save a retryable result for that and remaining URLs instead of
  // hammering the API or silently dropping links.
  for (let index = 0; index < urls.length; index++) {
    const result = await scanOneUrl(urls[index], apiKey)
    results.push(result)
    if (result.errorCode === "rate_limited") {
      for (const url of urls.slice(index + 1)) {
        results.push({
          url,
          status: "pending",
          analysisId: null,
          stats: null,
          response: null,
          scannedAt: new Date(),
          retryable: true,
          errorCode: "rate_limited",
        })
      }
      break
    }
  }

  return results
}

/** Recheck pending analyses without resubmitting URLs that already have IDs. */
export async function resumeVirusTotalUrlScans(
  results: VirusTotalUrlScanResult[]
): Promise<VirusTotalUrlScanResult[]> {
  if (!isVirusTotalScanningEnabled()) return results
  const apiKey = process.env.VIRUS_TOTAL_API_KEY
  if (!apiKey) return results

  const updated: VirusTotalUrlScanResult[] = []
  for (let index = 0; index < results.length; index++) {
    const result = results[index]
    if (!result.retryable || result.status !== "pending") {
      updated.push(result)
      continue
    }

    let resumed: VirusTotalUrlScanResult
    if (result.analysisId) {
      resumed = await getAnalysisResult(
        result.url,
        result.analysisId,
        (result.response?.submission as Record<string, unknown>) ?? null,
        apiKey
      )
    } else {
      resumed = await scanOneUrl(result.url, apiKey)
    }

    updated.push(resumed)
    if (resumed.errorCode === "rate_limited") {
      updated.push(...results.slice(index + 1))
      break
    }
  }
  return updated
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
