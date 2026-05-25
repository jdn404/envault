import { request as httpRequest } from 'http'
import { request as httpsRequest } from 'https'
import { createConnection } from 'net'
import { resolve as dnsResolve } from 'dns'
import { URL } from 'url'

export interface HealthCheckResult {
  key: string
  url: string
  status: 'ok' | 'fail' | 'timeout' | 'unreachable' | 'dns_fail'
  statusCode?: number
  responseTime?: number
  error?: string
  ssl?: {
    valid: boolean
    expires?: Date
    daysUntilExpiry?: number
    issuer?: string
    subject?: string
  }
}

export interface TcpCheckResult {
  host: string
  port: number
  status: 'ok' | 'fail' | 'timeout'
  responseTime?: number
  error?: string
}

export interface DnsCheckResult {
  hostname: string
  status: 'ok' | 'fail'
  addresses?: string[]
  error?: string
  responseTime?: number
}

export interface HealthReport {
  total: number
  passed: number
  failed: number
  duration: number
  results: HealthCheckResult[]
  tcpResults: TcpCheckResult[]
  dnsResults: DnsCheckResult[]
  summary: string
}

const DEFAULT_TIMEOUT = 5000
const DEFAULT_RETRIES = 2
const DEFAULT_BACKOFF = 500

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function checkUrl(url: string, timeout: number): Promise<{ statusCode: number; responseTime: number; ssl?: HealthCheckResult['ssl'] }> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    let parsed: URL

    try {
      parsed = new URL(url)
    } catch {
      return reject(new Error(`Invalid URL: ${url}`))
    }

    const isHttps = parsed.protocol === 'https:'
    const requester = isHttps ? httpsRequest : httpRequest

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'HEAD',
      timeout,
      headers: { 'User-Agent': 'envault-health/1.0' },
    }

    const req = requester(options as Parameters<typeof httpsRequest>[0], (res) => {
      const responseTime = Date.now() - start
      let ssl: HealthCheckResult['ssl'] | undefined

      if (isHttps && (res.socket as NodeJS.Socket & { getPeerCertificate?: () => { valid_to?: string; issuer?: { CN?: string }; subject?: { CN?: string } } }).getPeerCertificate) {
        try {
          const cert = (res.socket as NodeJS.Socket & { getPeerCertificate: () => { valid_to?: string; issuer?: { CN?: string }; subject?: { CN?: string } } }).getPeerCertificate()
          if (cert && cert.valid_to) {
            const expires = new Date(cert.valid_to)
            const daysUntilExpiry = Math.floor((expires.getTime() - Date.now()) / 86400000)
            ssl = {
              valid: daysUntilExpiry > 0,
              expires,
              daysUntilExpiry,
              issuer: cert.issuer?.CN,
              subject: cert.subject?.CN,
            }
          }
        } catch {}
      }

      res.resume()
      resolve({ statusCode: res.statusCode ?? 0, responseTime, ssl })
    })

    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')) })
    req.on('error', (e) => reject(e))
    req.setTimeout(timeout)
    req.end()
  })
}

function checkTcp(host: string, port: number, timeout: number): Promise<TcpCheckResult> {
  return new Promise((resolve) => {
    const start = Date.now()
    const socket = createConnection({ host, port, timeout })

    socket.on('connect', () => {
      const responseTime = Date.now() - start
      socket.destroy()
      resolve({ host, port, status: 'ok', responseTime })
    })

    socket.on('timeout', () => {
      socket.destroy()
      resolve({ host, port, status: 'timeout', error: 'Connection timed out' })
    })

    socket.on('error', (e) => {
      resolve({ host, port, status: 'fail', error: e.message })
    })
  })
}

function checkDns(hostname: string): Promise<DnsCheckResult> {
  return new Promise((resolve) => {
    const start = Date.now()
    dnsResolve(hostname, (err, addresses) => {
      const responseTime = Date.now() - start
      if (err) {
        resolve({ hostname, status: 'fail', error: err.message, responseTime })
      } else {
        resolve({ hostname, status: 'ok', addresses, responseTime })
      }
    })
  })
}

export async function checkUrlHealth(
  key: string,
  url: string,
  timeout: number = DEFAULT_TIMEOUT,
  retries: number = DEFAULT_RETRIES
): Promise<HealthCheckResult> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { key, url, status: 'fail', error: 'Invalid URL format' }
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { key, url, status: 'ok', statusCode: 0, responseTime: 0 }
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(DEFAULT_BACKOFF * attempt)

    try {
      const { statusCode, responseTime, ssl } = await checkUrl(url, timeout)
      return {
        key,
        url,
        status: statusCode >= 100 && statusCode < 600 ? 'ok' : 'fail',
        statusCode,
        responseTime,
        ssl,
      }
    } catch (e: unknown) {
      const msg = (e as Error).message
      if (msg === 'TIMEOUT') {
        if (attempt === retries) return { key, url, status: 'timeout', error: 'Request timed out' }
      } else if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
        if (attempt === retries) return { key, url, status: 'unreachable', error: msg }
      } else {
        if (attempt === retries) return { key, url, status: 'fail', error: msg }
      }
    }
  }

  return { key, url, status: 'fail', error: 'Unknown error' }
}

export async function checkDatabaseUrl(
  key: string,
  url: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<HealthCheckResult & { tcp?: TcpCheckResult }> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { key, url, status: 'fail', error: 'Invalid database URL format' }
  }

  const host = parsed.hostname
  const port = parseInt(parsed.port) || getDefaultPort(parsed.protocol)

  if (!host || !port) {
    return { key, url, status: 'fail', error: 'Cannot determine host or port from URL' }
  }

  const dnsResult = await checkDns(host)
  if (dnsResult.status === 'fail') {
    return { key, url, status: 'dns_fail', error: `DNS resolution failed: ${dnsResult.error}` }
  }

  const start = Date.now()
  const tcpResult = await checkTcp(host, port, timeout)
  const responseTime = Date.now() - start

  return {
    key,
    url,
    status: tcpResult.status === 'ok' ? 'ok' : tcpResult.status,
    responseTime,
    error: tcpResult.error,
  }
}

function getDefaultPort(protocol: string): number {
  const ports: Record<string, number> = {
    'postgresql:': 5432,
    'postgres:': 5432,
    'mysql:': 3306,
    'mongodb:': 27017,
    'mongodb+srv:': 27017,
    'redis:': 6379,
    'rediss:': 6380,
    'amqp:': 5672,
    'amqps:': 5671,
  }
  return ports[protocol] ?? 0
}

const DATABASE_PROTOCOLS = new Set(['postgresql:', 'postgres:', 'mysql:', 'mongodb:', 'mongodb+srv:', 'redis:', 'rediss:', 'amqp:', 'amqps:'])
const HTTP_PROTOCOLS = new Set(['http:', 'https:'])

export async function runHealthChecks(
  env: Record<string, unknown>,
  options: { timeout?: number; retries?: number; parallel?: boolean } = {}
): Promise<HealthReport> {
  const { timeout = DEFAULT_TIMEOUT, retries = DEFAULT_RETRIES, parallel = true } = options
  const start = Date.now()
  const results: HealthCheckResult[] = []
  const tcpResults: TcpCheckResult[] = []
  const dnsResults: DnsCheckResult[] = []

  const urlEntries: Array<{ key: string; url: string }> = []

  for (const [key, value] of Object.entries(env)) {
    if (typeof value !== 'string') continue
    try {
      const parsed = new URL(value)
      if (HTTP_PROTOCOLS.has(parsed.protocol) || DATABASE_PROTOCOLS.has(parsed.protocol)) {
        urlEntries.push({ key, url: value })
      }
    } catch {}
  }

  if (parallel) {
    const settled = await Promise.allSettled(
      urlEntries.map(({ key, url }) => {
        try {
          const parsed = new URL(url)
          if (DATABASE_PROTOCOLS.has(parsed.protocol)) {
            return checkDatabaseUrl(key, url, timeout)
          }
          return checkUrlHealth(key, url, timeout, retries)
        } catch {
          return Promise.resolve({ key, url, status: 'fail' as const, error: 'Invalid URL' })
        }
      })
    )

    for (const result of settled) {
      if (result.status === 'fulfilled') results.push(result.value)
    }
  } else {
    for (const { key, url } of urlEntries) {
      try {
        const parsed = new URL(url)
        if (DATABASE_PROTOCOLS.has(parsed.protocol)) {
          results.push(await checkDatabaseUrl(key, url, timeout))
        } else {
          results.push(await checkUrlHealth(key, url, timeout, retries))
        }
      } catch {
        results.push({ key, url, status: 'fail', error: 'Invalid URL' })
      }
    }
  }

  const duration = Date.now() - start
  const passed = results.filter(r => r.status === 'ok').length
  const failed = results.length - passed

  return {
    total: results.length,
    passed,
    failed,
    duration,
    results,
    tcpResults,
    dnsResults,
    summary: `${passed}/${results.length} checks passed in ${duration}ms`,
  }
}

export async function checkSslExpiry(
  url: string,
  warnDaysBeforeExpiry: number = 30
): Promise<{ valid: boolean; daysUntilExpiry: number; warning: boolean; error?: string }> {
  try {
    const result = await checkUrl(url, DEFAULT_TIMEOUT)
    if (!result.ssl) return { valid: false, daysUntilExpiry: 0, warning: false, error: 'No SSL info available' }
    const { valid, daysUntilExpiry = 0 } = result.ssl
    return { valid, daysUntilExpiry, warning: daysUntilExpiry < warnDaysBeforeExpiry }
  } catch (e: unknown) {
    return { valid: false, daysUntilExpiry: 0, warning: false, error: (e as Error).message }
  }
}

export function formatHealthReport(report: HealthReport, color: boolean = true): string {
  const c = color ? (code: number, text: string) => `\x1b[${code}m${text}\x1b[0m` : (_: number, text: string) => text
  const lines: string[] = ['']

  lines.push(c(36, `  envault health — ${report.summary}`))
  lines.push('')

  if (report.results.length === 0) {
    lines.push(c(90, '  No URL variables found to check'))
    lines.push('')
    return lines.join('\n')
  }

  for (const result of report.results) {
    const icon = result.status === 'ok' ? c(32, '✔') : result.status === 'timeout' ? c(33, '⏱') : c(31, '✖')
    const keyStr = c(33, result.key.padEnd(32))
    const timeStr = result.responseTime !== undefined ? c(90, `${result.responseTime}ms`) : ''
    const statusStr = result.status === 'ok'
      ? c(32, `${result.statusCode ?? 'tcp:ok'}`)
      : c(31, result.error ?? result.status)

    lines.push(`  ${icon}  ${keyStr}${statusStr}  ${timeStr}`)

    if (result.ssl) {
      const sslIcon = result.ssl.valid ? c(32, '🔒') : c(31, '🔓')
      const daysStr = result.ssl.daysUntilExpiry !== undefined
        ? result.ssl.daysUntilExpiry < 30
          ? c(33, `${result.ssl.daysUntilExpiry} days until expiry`)
          : c(90, `${result.ssl.daysUntilExpiry} days until expiry`)
        : ''
      lines.push(`       ${sslIcon} SSL  ${daysStr}`)
    }
  }

  lines.push('')
  lines.push(
    report.failed === 0
      ? c(32, `  ✔ All ${report.total} checks passed`)
      : c(31, `  ✖ ${report.failed} of ${report.total} checks failed`)
  )
  lines.push('')

  return lines.join('\n')
}
