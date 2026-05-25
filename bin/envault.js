#!/usr/bin/env node
import {
  readFileSync, writeFileSync, existsSync, readdirSync, statSync,
  watch, mkdirSync, chmodSync, appendFileSync,
} from 'fs'
import { resolve, join, extname, relative, dirname, basename } from 'path'
import { spawnSync, spawn } from 'child_process'
import { createCipheriv, createDecipheriv, createECDH, randomBytes, scryptSync, createHmac, createHash } from 'crypto'
import { createConnection } from 'net'
import { request as httpReq } from 'http'
import { request as httpsReq } from 'https'

const command = process.argv[2]
const args    = process.argv.slice(3)
const cwd     = process.cwd()

const c    = (code, text) => `\x1b[${code}m${text}\x1b[0m`
const bold = text => `\x1b[1m${text}\x1b[0m`
const dim  = text => `\x1b[2m${text}\x1b[0m`

const SECRET_KEYWORDS  = ['SECRET', 'KEY', 'TOKEN', 'PASSWORD', 'PASS', 'PWD', 'PRIVATE', 'CREDENTIAL', 'AUTH', 'HASH', 'SALT', 'SIGNING', 'CIPHER', 'WEBHOOK', 'API_KEY', 'ACCESS_KEY', 'CLIENT_SECRET']
const URL_KEYWORDS     = ['URL', 'URI', 'ENDPOINT', 'DSN', 'CONNECTION_STRING', 'DATABASE_URL', 'REDIS_URL', 'MONGO_URL']
const BOOL_KEYWORDS    = ['ENABLE', 'DISABLE', 'DEBUG', 'VERBOSE', 'FLAG', 'ACTIVE', 'FEATURE', 'MOCK', 'ENABLED', 'DISABLED', 'ALLOW', 'BLOCK']
const NUM_KEYWORDS     = ['PORT', 'TIMEOUT', 'LIMIT', 'MAX', 'MIN', 'COUNT', 'SIZE', 'TTL', 'RETRY', 'DELAY', 'INTERVAL', 'CONCURRENCY', 'WORKERS', 'CONNECTIONS', 'THRESHOLD', 'RATE', 'ATTEMPTS']
const ALWAYS_SET_KEYS  = new Set(['NODE_ENV', 'CI', 'PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'LANG', 'npm_lifecycle_event', 'npm_package_version', 'npm_package_name', 'NEXT_RUNTIME', 'VERCEL', 'VERCEL_ENV', 'RAILWAY_ENVIRONMENT', 'RENDER', 'FLY_APP_NAME', 'NETLIFY'])
const IGNORE_DIRS      = new Set(['node_modules', '.git', 'dist', '.next', 'build', 'coverage', '.turbo', 'out', '.cache', '.vercel', '.svelte-kit', '.nuxt', 'storybook-static', '.output', '.vinxi'])
const CODE_EXTS        = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.svelte', '.vue', '.astro'])
const DB_PROTOCOLS     = new Set(['postgresql:', 'postgres:', 'mysql:', 'mongodb:', 'mongodb+srv:', 'redis:', 'rediss:', 'amqp:', 'amqps:'])

const CURVE      = 'prime256v1'
const AES_ALGO   = 'aes-256-gcm'
const ENC_PREFIX = 'enc:'
const KEY_LEN    = 32
const IV_LEN     = 12
const TAG_LEN    = 16
const SALT_LEN   = 32
const SCRYPT_N   = 32768

const WEAK_PASSWORDS = new Set([
  'password', 'password123', 'secret', 'changeme', 'admin', 'letmein', 'welcome',
  '123456', 'qwerty', 'abc123', 'master', 'pass', 'test', 'temp', 'default', 'root',
  'guest', 'login', 'monkey', 'dragon', 'shadow', 'hello', 'iloveyou', '1234567890',
  'passw0rd', 'trustno1', 'superman', 'batman', 'football', 'baseball',
])

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {}
  const lines = readFileSync(filePath, 'utf-8').split('\n')
  const result = {}
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    i++

    if (!trimmed || trimmed.startsWith('#')) continue

    const eq = trimmed.indexOf('=')
    if (eq === -1) continue

    const key = trimmed.slice(0, eq).trim()
    if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue

    let raw = trimmed.slice(eq + 1)

    if (raw.startsWith('"')) {
      let inner = raw.slice(1)
      while (!inner.endsWith('"') && i < lines.length) { inner += '\n' + lines[i]; i++ }
      raw = inner.endsWith('"') ? inner.slice(0, -1) : inner
      raw = raw.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    } else if (raw.startsWith("'")) {
      let inner = raw.slice(1)
      while (!inner.endsWith("'") && i < lines.length) { inner += '\n' + lines[i]; i++ }
      raw = inner.endsWith("'") ? inner.slice(0, -1) : inner
    } else if (raw.startsWith('`')) {
      let inner = raw.slice(1)
      while (!inner.endsWith('`') && i < lines.length) { inner += '\n' + lines[i]; i++ }
      raw = inner.endsWith('`') ? inner.slice(0, -1) : inner
    } else {
      const ci = raw.indexOf(' #')
      if (ci !== -1) raw = raw.slice(0, ci)
      raw = raw.trim()
    }

    result[key] = raw
  }
  return result
}

function maskValue(val) {
  if (!val || val.length === 0) return c(90, '(empty)')
  if (val.length <= 4) return '****'
  return val.slice(0, 2) + '*'.repeat(Math.min(val.length - 2, 20))
}

function isSecret(key) {
  const u = key.toUpperCase()
  return SECRET_KEYWORDS.some(k => u.includes(k))
}

function guessType(key) {
  const u = key.toUpperCase()
  if (isSecret(key)) return 'secret()'
  if (u === 'PORT' || u.endsWith('_PORT')) return 'port()'
  if (URL_KEYWORDS.some(k => u.includes(k))) return 'url()'
  if (BOOL_KEYWORDS.some(k => u === k || u.endsWith('_' + k) || u.startsWith(k + '_'))) return 'bool()'
  if (NUM_KEYWORDS.some(k => u.includes(k))) return 'num()'
  return 'str()'
}

function walkDir(dir) {
  const results = []
  if (!existsSync(dir)) return results
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue
    const full = join(dir, entry)
    try {
      const stat = statSync(full)
      if (stat.isDirectory()) results.push(...walkDir(full))
      else if (CODE_EXTS.has(extname(entry))) results.push(full)
    } catch {}
  }
  return results
}

function findEnvUsageInCode() {
  const files = walkDir(cwd)
  const found = new Map()
  const patterns = [
    /process\.env\.([A-Z_][A-Z0-9_]*)/g,
    /process\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
    /import\.meta\.env\.([A-Z_][A-Z0-9_]*)/g,
    /import\.meta\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
    /env\.([A-Z_][A-Z0-9_]*)/g,
    /Deno\.env\.get\(['"]([A-Z_][A-Z0-9_]*)['"]\)/g,
    /Bun\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
  ]
  const destructurePattern = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*(?:process\.env|env|Bun\.env)/g

  for (const file of files) {
    let content
    try { content = readFileSync(file, 'utf-8') } catch { continue }
    const rel = relative(cwd, file)

    for (const pattern of patterns) {
      pattern.lastIndex = 0
      for (const match of content.matchAll(pattern)) {
        const key = match[1]
        if (!found.has(key)) found.set(key, new Set())
        found.get(key).add(rel)
      }
    }

    destructurePattern.lastIndex = 0
    for (const match of content.matchAll(destructurePattern)) {
      const keys = match[1].split(',').map(k => {
        const part = k.trim().split(/\s*:\s*/)[0].trim()
        return part.replace(/\s*=.*$/, '').trim()
      })
      for (const key of keys) {
        if (/^[A-Z_][A-Z0-9_]*$/.test(key)) {
          if (!found.has(key)) found.set(key, new Set())
          found.get(key).add(rel)
        }
      }
    }
  }

  return new Map([...found.entries()].map(([k, v]) => [k, [...v]]))
}

function findSecretLeaks() {
  const files = walkDir(cwd)
  const seen = new Set()
  const leaks = []
  const logPatterns = [
    /console\.\w+\([^)]*process\.env\.([A-Z_][A-Z0-9_]*)/g,
    /console\.\w+\([^)]*env\.([A-Z_][A-Z0-9_]*)/g,
    /console\.\w+\(`[^`]*\$\{(?:process\.env|env)\.([A-Z_][A-Z0-9_]*)\}/g,
    /logger\.\w+\([^)]*(?:process\.env|env)\.([A-Z_][A-Z0-9_]*)/g,
    /winston\.\w+\([^)]*(?:process\.env|env)\.([A-Z_][A-Z0-9_]*)/g,
  ]

  for (const file of files) {
    let content
    try { content = readFileSync(file, 'utf-8') } catch { continue }
    const rel = relative(cwd, file)

    for (const pattern of logPatterns) {
      pattern.lastIndex = 0
      for (const match of content.matchAll(pattern)) {
        const key = match[1]
        const id = `${key}::${rel}`
        if (!seen.has(id) && isSecret(key)) {
          seen.add(id)
          leaks.push({ key, file: rel })
        }
      }
    }
  }
  return leaks
}

function shannonEntropy(str) {
  const freq = {}
  for (const ch of str) freq[ch] = (freq[ch] ?? 0) + 1
  const len = str.length
  return -Object.values(freq).reduce((acc, count) => {
    const p = count / len
    return acc + p * Math.log2(p)
  }, 0)
}

function scoreSecret(val) {
  if (!val) return { score: 0, level: 'critical', suggestions: ['Value is empty'] }

  const hasUpper   = /[A-Z]/.test(val)
  const hasLower   = /[a-z]/.test(val)
  const hasDigits  = /[0-9]/.test(val)
  const hasSpecial = /[^A-Za-z0-9]/.test(val)
  const isWeak     = WEAK_PASSWORDS.has(val.toLowerCase())
  const charsetSize = (hasUpper ? 26 : 0) + (hasLower ? 26 : 0) + (hasDigits ? 10 : 0) + (hasSpecial ? 32 : 0)
  const bits       = val.length * Math.log2(Math.max(charsetSize, 1))

  let score = 0
  if (val.length >= 8)  score += 10
  if (val.length >= 16) score += 15
  if (val.length >= 32) score += 25
  if (hasUpper)         score += 10
  if (hasLower)         score += 10
  if (hasDigits)        score += 10
  if (hasSpecial)       score += 15
  if (!isWeak)          score += 5
  if (bits >= 60)       score += 20
  if (isWeak)           score  = Math.min(score, 20)

  const level = score >= 90 ? 'excellent' : score >= 70 ? 'strong' : score >= 50 ? 'fair' : score >= 30 ? 'weak' : 'critical'
  const color = level === 'excellent' || level === 'strong' ? 32 : level === 'fair' ? 33 : 31

  const suggestions = []
  if (val.length < 16)  suggestions.push('Use at least 16 characters')
  if (!hasUpper)        suggestions.push('Add uppercase letters')
  if (!hasLower)        suggestions.push('Add lowercase letters')
  if (!hasDigits)       suggestions.push('Add numbers')
  if (!hasSpecial)      suggestions.push('Add special characters (!@#$%^&*)')
  if (isWeak)           suggestions.push('This is a commonly known password — change it immediately')
  if (bits < 40)        suggestions.push('Add more randomness — use a secure random generator')

  return { score, level, color, bits: Math.round(bits), length: val.length, suggestions }
}

function deriveKey(sharedSecret, salt) {
  return scryptSync(sharedSecret, salt, KEY_LEN, { N: SCRYPT_N, r: 8, p: 1 })
}

function encryptValue(plaintext, publicKeyB64) {
  const ecdh = createECDH(CURVE)
  ecdh.generateKeys()
  const ephemeralPub = ecdh.getPublicKey('hex', 'uncompressed')
  const sharedSecret = ecdh.computeSecret(Buffer.from(publicKeyB64, 'base64'))
  const salt = randomBytes(SALT_LEN)
  const derivedKey = deriveKey(sharedSecret.toString('hex'), salt)
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(AES_ALGO, derivedKey, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const payload = Buffer.concat([Buffer.from(ephemeralPub, 'hex'), salt, iv, tag, encrypted])
  return ENC_PREFIX + payload.toString('base64')
}

function decryptValue(ciphertext, privateKeyB64) {
  if (!ciphertext.startsWith(ENC_PREFIX)) return ciphertext
  const payload = Buffer.from(ciphertext.slice(ENC_PREFIX.length), 'base64')
  const ephemeralPub = payload.subarray(0, 65)
  const salt        = payload.subarray(65, 65 + SALT_LEN)
  const iv          = payload.subarray(65 + SALT_LEN, 65 + SALT_LEN + IV_LEN)
  const tag         = payload.subarray(65 + SALT_LEN + IV_LEN, 65 + SALT_LEN + IV_LEN + TAG_LEN)
  const encrypted   = payload.subarray(65 + SALT_LEN + IV_LEN + TAG_LEN)
  const ecdh = createECDH(CURVE)
  ecdh.setPrivateKey(Buffer.from(privateKeyB64, 'base64'))
  const sharedSecret = ecdh.computeSecret(ephemeralPub)
  const derivedKey   = deriveKey(sharedSecret.toString('hex'), salt)
  const decipher     = createDecipheriv(AES_ALGO, derivedKey, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

function generateKeyPair() {
  const ecdh = createECDH(CURVE)
  ecdh.generateKeys()
  return { publicKey: ecdh.getPublicKey('base64', 'uncompressed'), privateKey: ecdh.getPrivateKey('base64') }
}

function generateSecureSecret(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  const bytes = randomBytes(length)
  let result = ''
  for (let i = 0; i < length; i++) result += chars[bytes[i] % chars.length]
  return result
}

function generateApiKey(prefix = 'sk', length = 32) {
  return `${prefix}_${randomBytes(length).toString('hex')}`
}

function readPackageJson(dir = cwd) {
  const pkgPath = join(dir, 'package.json')
  if (!existsSync(pkgPath)) return {}
  try { return JSON.parse(readFileSync(pkgPath, 'utf-8')) } catch { return {} }
}

function detectFramework() {
  const pkg = readPackageJson()
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  if (deps['next']) return 'next'
  if (deps['vite']) return 'vite'
  if (deps['astro']) return 'astro'
  if (deps['@sveltejs/kit']) return 'sveltekit'
  if (deps['nuxt']) return 'nuxt'
  if (deps['@remix-run/node']) return 'remix'
  if (deps['express']) return 'express'
  if (deps['fastify']) return 'fastify'
  if (deps['@nestjs/core']) return 'nestjs'
  if (deps['hono']) return 'hono'
  if (deps['elysia']) return 'elysia'
  return null
}

function checkUrl(url, timeout = 5000) {
  return new Promise((resolve) => {
    let parsed
    try { parsed = new URL(url) } catch { return resolve({ status: 'fail', error: 'Invalid URL' }) }
    const requester = parsed.protocol === 'https:' ? httpsReq : httpReq
    const start = Date.now()
    const req = requester({ hostname: parsed.hostname, port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80), path: parsed.pathname, method: 'HEAD', timeout, headers: { 'User-Agent': 'envault/1.0' } }, res => {
      res.resume()
      resolve({ status: 'ok', statusCode: res.statusCode, responseTime: Date.now() - start })
    })
    req.on('timeout', () => { req.destroy(); resolve({ status: 'timeout', error: 'Timed out' }) })
    req.on('error', e => resolve({ status: 'fail', error: e.message }))
    req.setTimeout(timeout)
    req.end()
  })
}

function checkTcp(host, port, timeout = 5000) {
  return new Promise((resolve) => {
    const start = Date.now()
    const socket = createConnection({ host, port, timeout })
    socket.on('connect', () => { socket.destroy(); resolve({ status: 'ok', responseTime: Date.now() - start }) })
    socket.on('timeout', () => { socket.destroy(); resolve({ status: 'timeout' }) })
    socket.on('error', e => resolve({ status: 'fail', error: e.message }))
  })
}

function getDefaultDbPort(protocol) {
  const ports = { 'postgresql:': 5432, 'postgres:': 5432, 'mysql:': 3306, 'mongodb:': 27017, 'mongodb+srv:': 27017, 'redis:': 6379, 'rediss:': 6380 }
  return ports[protocol] ?? null
}

const commands = {
  check() {
    const envPath = resolve(cwd, '.env')
    if (!existsSync(envPath)) { console.log(c(31, '\n  ✖ No .env file found\n')); process.exit(1) }
    const vars = parseEnvFile(envPath)
    const count = Object.keys(vars).length
    const empty = Object.values(vars).filter(v => !v).length
    const secrets = Object.keys(vars).filter(k => isSecret(k))
    const urls    = Object.keys(vars).filter(k => URL_KEYWORDS.some(u => k.toUpperCase().includes(u)))
    console.log('')
    console.log(c(32, `  ✔ Found ${count} variable${count !== 1 ? 's' : ''} in .env`))
    if (empty > 0)   console.log(c(33, `  ⚠  ${empty} variable${empty !== 1 ? 's are' : ' is'} empty`))
    if (secrets.length > 0) console.log(c(90, `  🔒  ${secrets.length} secret${secrets.length !== 1 ? 's' : ''} detected`))
    if (urls.length > 0)    console.log(c(90, `  🌐  ${urls.length} URL${urls.length !== 1 ? 's' : ''} detected`))
    console.log('')
  },

  doctor() {
    const envFiles = [
      '.env', '.env.local', '.env.development', '.env.development.local',
      '.env.production', '.env.production.local', '.env.test', '.env.test.local',
      '.env.staging', '.env.staging.local',
    ].map(f => resolve(cwd, f)).filter(f => existsSync(f))

    if (envFiles.length === 0) { console.log(c(33, '\n  No .env files found\n')); return }
    console.log('')
    console.log(c(36, bold('  envault doctor')))
    console.log('')

    let totalVars = 0
    let totalSecrets = 0
    let totalEmpty = 0

    for (const filePath of envFiles) {
      const label = relative(cwd, filePath)
      const vars = parseEnvFile(filePath)
      const keys = Object.keys(vars)
      totalVars += keys.length
      console.log(c(90, `  ── ${label}`) + c(90, ` (${keys.length} vars)`))

      if (keys.length === 0) { console.log(c(90, '     (empty)')); continue }

      for (const [key, val] of Object.entries(vars)) {
        const sensitive = isSecret(key)
        if (sensitive) totalSecrets++
        if (!val) totalEmpty++
        const display = sensitive ? maskValue(val) : (val || c(90, '(empty)'))
        const dot = val ? c(32, '●') : c(31, '○')
        const tag = sensitive ? c(35, ' 🔒') : ''
        console.log(`  ${dot}  ${c(33, key.padEnd(32))}${display}${tag}`)
      }
      console.log('')
    }

    console.log(c(90, `  Total: ${totalVars} vars · ${totalSecrets} secrets · ${totalEmpty} empty`))
    console.log('')
  },

  generate() {
    const envPath = resolve(cwd, '.env')
    if (!existsSync(envPath)) { console.log(c(31, '\n  ✖ No .env file found\n')); process.exit(1) }
    const vars = parseEnvFile(envPath)
    const outPath = resolve(cwd, args[0] ?? '.env.example')
    const lines = []
    const groups = new Map()

    for (const [key, val] of Object.entries(vars)) {
      const prefix = key.split('_')[0]
      if (!groups.has(prefix)) groups.set(prefix, [])
      groups.get(prefix).push([key, val])
    }

    for (const [prefix, entries] of groups) {
      if (entries.length > 1) lines.push(`\n# ${prefix}`)
      for (const [key, val] of entries) {
        const sensitive = isSecret(key)
        lines.push(`${key}=${sensitive ? '' : val}`)
      }
    }

    writeFileSync(outPath, lines.join('\n').trim() + '\n')
    console.log('')
    console.log(c(32, `  ✔ Generated ${relative(cwd, outPath)} with ${Object.keys(vars).length} key${Object.keys(vars).length !== 1 ? 's' : ''}`))
    console.log(c(90, `     Secrets cleared, non-sensitive values preserved`))
    console.log('')
  },

  audit() {
    const envPath = resolve(cwd, '.env')
    const envVars = parseEnvFile(envPath)
    const envKeys = new Set(Object.keys(envVars))
    console.log('')
    console.log(c(36, bold('  envault audit')))
    console.log('')

    const codeUsage = findEnvUsageInCode()
    const leaks = findSecretLeaks()
    let issues = 0

    for (const [key, files] of codeUsage) {
      if (ALWAYS_SET_KEYS.has(key)) continue
      if (!envKeys.has(key)) {
        console.log(`  ${c(31, '✖')}  ${c(33, key.padEnd(32))}used in code but missing from .env`)
        const preview = files.slice(0, 2).join(', ') + (files.length > 2 ? ` +${files.length - 2} more` : '')
        console.log(c(90, `       ${preview}`))
        issues++
      }
    }

    for (const key of Object.keys(envVars)) {
      if (!codeUsage.has(key) && !ALWAYS_SET_KEYS.has(key)) {
        console.log(`  ${c(33, '⚠')}  ${c(33, key.padEnd(32))}defined in .env but not found in code`)
        issues++
      }
    }

    if (leaks.length > 0) {
      console.log('')
      console.log(c(31, '  Potential secret leaks in code:'))
      for (const { key, file } of leaks) {
        console.log(`  ${c(31, '✖')}  ${c(33, key.padEnd(32))}logged to console in ${c(90, file)}`)
        issues++
      }
    }

    console.log('')
    if (issues === 0) console.log(c(32, '  ✔ All clear — no issues found'))
    else console.log(c(33, `  ${issues} issue${issues !== 1 ? 's' : ''} found`))
    console.log('')
  },

  diff() {
    const fileA = args[0] ? resolve(cwd, args[0]) : resolve(cwd, '.env')
    const fileB = args[1] ? resolve(cwd, args[1]) : resolve(cwd, '.env.production')
    if (!existsSync(fileA)) { console.log(c(31, `\n  ✖ Not found: ${fileA}\n`)); process.exit(1) }
    if (!existsSync(fileB)) { console.log(c(31, `\n  ✖ Not found: ${fileB}\n`)); process.exit(1) }

    const a = parseEnvFile(fileA)
    const b = parseEnvFile(fileB)
    const allKeys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()

    console.log('')
    console.log(c(36, bold('  envault diff')))
    console.log(c(90, `  ${relative(cwd, fileA)}  →  ${relative(cwd, fileB)}`))
    console.log('')

    let diffs = 0
    for (const key of allKeys) {
      const inA = key in a
      const inB = key in b
      const sensitive = isSecret(key)
      if (!inA) {
        console.log(`  ${c(32, '+')}  ${c(33, key.padEnd(32))}${c(90, `only in ${relative(cwd, fileB)}`)}`)
        diffs++
      } else if (!inB) {
        console.log(`  ${c(31, '-')}  ${c(33, key.padEnd(32))}${c(90, `only in ${relative(cwd, fileA)}`)}`)
        diffs++
      } else if (a[key] !== b[key]) {
        const dA = sensitive ? maskValue(a[key]) : (a[key] || c(90, '(empty)'))
        const dB = sensitive ? maskValue(b[key]) : (b[key] || c(90, '(empty)'))
        console.log(`  ${c(33, '~')}  ${c(33, key.padEnd(32))}${dA}  ${c(90, '→')}  ${dB}`)
        diffs++
      }
    }

    console.log('')
    if (diffs === 0) console.log(c(32, '  ✔ Files are identical'))
    else console.log(c(90, `  ${diffs} difference${diffs !== 1 ? 's' : ''}`))
    console.log('')
  },

  watch() {
    const targetFile = args[0] ? resolve(cwd, args[0]) : resolve(cwd, '.env')
    if (!existsSync(targetFile)) { console.log(c(31, `\n  ✖ Not found: ${targetFile}\n`)); process.exit(1) }
    const label = relative(cwd, targetFile)
    console.log('')
    console.log(c(36, bold('  envault watch')))
    console.log(c(90, `  Watching ${label} for changes... (Ctrl+C to stop)`))
    console.log('')

    let prev = parseEnvFile(targetFile)
    let debounce = null

    watch(targetFile, () => {
      clearTimeout(debounce)
      debounce = setTimeout(() => {
        const curr = parseEnvFile(targetFile)
        const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)])
        const changes = []
        for (const key of allKeys) {
          if (!(key in prev)) changes.push({ type: 'added', key })
          else if (!(key in curr)) changes.push({ type: 'removed', key })
          else if (prev[key] !== curr[key]) changes.push({ type: 'changed', key })
        }
        if (changes.length > 0) {
          console.log(c(90, `  [${new Date().toLocaleTimeString()}]`))
          for (const ch of changes) {
            if (ch.type === 'added')        console.log(`  ${c(32, '+')} ${c(33, ch.key)} added`)
            else if (ch.type === 'removed') console.log(`  ${c(31, '-')} ${c(33, ch.key)} removed`)
            else                            console.log(`  ${c(33, '~')} ${c(33, ch.key)} changed`)
          }
          console.log('')
          prev = curr
        }
      }, 80)
    })
  },

  validate() {
    const targetFile = args[0]
    if (!targetFile) { console.log(c(31, '\n  Usage: envault validate <file>\n')); process.exit(1) }
    const filePath = resolve(cwd, targetFile)
    if (!existsSync(filePath)) { console.log(c(31, `\n  ✖ File not found: ${filePath}\n`)); process.exit(1) }

    const vars = parseEnvFile(filePath)
    const count = Object.keys(vars).length
    const empty = Object.values(vars).filter(v => !v).length
    const dupes = []
    const seen = new Map()

    for (const line of readFileSync(filePath, 'utf-8').split('\n')) {
      const eq = line.indexOf('=')
      if (eq === -1) continue
      const key = line.slice(0, eq).trim()
      if (!key || key.startsWith('#')) continue
      seen.set(key, (seen.get(key) ?? 0) + 1)
    }
    for (const [k, n] of seen) if (n > 1) dupes.push(k)

    console.log('')
    console.log(c(36, bold(`  envault validate  ${c(90, relative(cwd, filePath))}`)))
    console.log('')
    console.log(`  ${c(32, '✔')}  ${count} variable${count !== 1 ? 's' : ''} parsed`)
    if (empty > 0) console.log(`  ${c(33, '⚠')}  ${empty} empty value${empty !== 1 ? 's' : ''}`)
    for (const k of dupes) console.log(`  ${c(31, '✖')}  ${c(33, k)} is defined more than once`)
    if (empty === 0 && dupes.length === 0) console.log(c(32, '  ✔ File is clean'))
    console.log('')
  },

  export() {
    const envPath = resolve(cwd, args[0] ?? '.env')
    if (!existsSync(envPath)) { console.log(c(31, `\n  ✖ Not found: ${envPath}\n`)); process.exit(1) }
    const format = args[1]
    const vars = parseEnvFile(envPath)

    if (format === '--shell') {
      for (const [k, v] of Object.entries(vars)) process.stdout.write(`export ${k}="${v.replace(/"/g, '\\"')}"\n`)
    } else if (format === '--dotenv') {
      for (const [k, v] of Object.entries(vars)) process.stdout.write(`${k}=${v}\n`)
    } else if (format === '--yaml') {
      process.stdout.write('env:\n')
      for (const [k, v] of Object.entries(vars)) process.stdout.write(`  ${k}: "${v.replace(/"/g, '\\"')}"\n`)
    } else if (format === '--docker') {
      for (const [k, v] of Object.entries(vars)) process.stdout.write(`-e ${k}="${v.replace(/"/g, '\\"')}" \\\n`)
    } else if (format === '--github') {
      for (const [k, v] of Object.entries(vars)) process.stdout.write(`echo "${k}=${v}" >> $GITHUB_ENV\n`)
    } else {
      process.stdout.write(JSON.stringify(vars, null, 2) + '\n')
    }
  },

  secrets() {
    const envFiles = ['.env', '.env.local', '.env.production', '.env.staging']
      .map(f => resolve(cwd, f))
      .filter(f => existsSync(f))

    if (envFiles.length === 0) { console.log(c(33, '\n  No .env files found\n')); return }

    console.log('')
    console.log(c(36, bold('  envault secrets')))
    console.log(c(90, '  All detected secrets across your env files\n'))

    for (const filePath of envFiles) {
      const vars = parseEnvFile(filePath)
      const secrets = Object.entries(vars).filter(([key]) => isSecret(key))
      if (secrets.length === 0) continue

      console.log(c(90, `  ── ${relative(cwd, filePath)}`))
      for (const [key, val] of secrets) {
        const { score, level, color, bits, length } = scoreSecret(val)
        const strengthBar = '█'.repeat(Math.floor(score / 10)) + '░'.repeat(10 - Math.floor(score / 10))
        console.log(`  ${c(color, '●')}  ${c(33, key.padEnd(32))}${maskValue(val)}`)
        console.log(`     ${c(color, strengthBar)} ${c(color, level)} ${c(90, `(${length} chars · ~${bits} bits)`)}`)
      }
      console.log('')
    }
  },

  copy() {
    const srcFile = args[0]
    const dstFile = args[1]
    if (!srcFile || !dstFile) { console.log(c(31, '\n  Usage: envault copy <source> <destination>\n')); process.exit(1) }
    const src = resolve(cwd, srcFile)
    const dst = resolve(cwd, dstFile)
    if (!existsSync(src)) { console.log(c(31, `\n  ✖ Not found: ${src}\n`)); process.exit(1) }

    const srcVars = parseEnvFile(src)
    const dstVars = existsSync(dst) ? parseEnvFile(dst) : {}
    const added = []

    for (const [k, v] of Object.entries(srcVars)) {
      if (!(k in dstVars)) { dstVars[k] = v; added.push(k) }
    }

    const lines = Object.entries(dstVars).map(([k, v]) => `${k}=${v}`)
    writeFileSync(dst, lines.join('\n') + '\n')
    console.log('')
    console.log(c(32, `  ✔ Copied ${added.length} new variable${added.length !== 1 ? 's' : ''} from ${srcFile} → ${dstFile}`))
    for (const k of added) console.log(c(90, `     + ${k}`))
    console.log('')
  },

  encrypt() {
    const targetFile = args[0] ?? '.env'
    const environment = args[1] ?? (process.env.NODE_ENV ?? 'development')
    const filePath = resolve(cwd, targetFile)
    if (!existsSync(filePath)) { console.log(c(31, `\n  ✖ File not found: ${filePath}\n`)); process.exit(1) }

    const content = readFileSync(filePath, 'utf-8')
    const vars = parseEnvFile(filePath)
    const encVarCount = Object.values(vars).filter(v => v.startsWith(ENC_PREFIX)).length

    if (encVarCount > 0 && encVarCount === Object.keys(vars).length) {
      console.log(c(33, `\n  ⚠ ${targetFile} is already fully encrypted\n`))
      return
    }

    let publicKey, privateKey
    const keyFilePath = resolve(cwd, '.env.keys')
    const envVar = `ENVAULT_PUBLIC_KEY_${environment.toUpperCase()}`
    const privVar = `ENVAULT_PRIVATE_KEY_${environment.toUpperCase()}`

    if (existsSync(keyFilePath)) {
      const keyVars = parseEnvFile(keyFilePath)
      if (keyVars[envVar] && keyVars[privVar]) {
        publicKey = keyVars[envVar]
        privateKey = keyVars[privVar]
      }
    }

    if (!publicKey) {
      const pair = generateKeyPair()
      publicKey = pair.publicKey
      privateKey = pair.privateKey
    }

    const lines = [
      '#/-------------------[ENVAULT_PUBLIC_KEY]--------------------/',
      '#/ public-key encryption for .env files                     /',
      '#/-----------------------------------------------------------/',
      `ENVAULT_PUBLIC_KEY_${environment.toUpperCase()}="${publicKey}"`,
      '',
    ]

    const originalLines = content.split('\n')
    for (const line of originalLines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) { if (trimmed.startsWith('#') || !trimmed) lines.push(line); continue }
      const eq = line.indexOf('=')
      if (eq === -1) { lines.push(line); continue }
      const key = line.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1)
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
      if (key.startsWith('ENVAULT_PUBLIC_KEY') || !val || val.startsWith(ENC_PREFIX)) { lines.push(line); continue }
      lines.push(`${key}="${encryptValue(val, publicKey)}"`)
    }

    writeFileSync(filePath, lines.join('\n') + '\n')

    const keyLines = [
      '#/------------------!ENVAULT_PRIVATE_KEYS!------------------/',
      '#/ private decryption keys. DO NOT commit to source control  /',
      '#/-----------------------------------------------------------/',
      '',
      `ENVAULT_PRIVATE_KEY_${environment.toUpperCase()}="${privateKey}"`,
      '',
    ]

    if (existsSync(keyFilePath)) {
      const existing = readFileSync(keyFilePath, 'utf-8')
      if (!existing.includes(privVar)) appendFileSync(keyFilePath, `${privVar}="${privateKey}"\n`)
    } else {
      writeFileSync(keyFilePath, keyLines.join('\n'))
    }

    const gitignorePath = resolve(cwd, '.gitignore')
    if (existsSync(gitignorePath)) {
      const gitignore = readFileSync(gitignorePath, 'utf-8')
      if (!gitignore.includes('.env.keys')) appendFileSync(gitignorePath, '\n.env.keys\n')
    } else {
      writeFileSync(gitignorePath, '.env.keys\n')
    }

    const valueCount = Object.values(vars).filter(v => v && !v.startsWith(ENC_PREFIX)).length
    console.log('')
    console.log(c(32, bold(`  ✔ Encrypted ${valueCount} value${valueCount !== 1 ? 's' : ''} in ${targetFile}`)))
    console.log(c(90, `  Private key saved to .env.keys (added to .gitignore)`))
    console.log(c(90, `  Public key embedded in ${targetFile} — safe to commit`))
    console.log(c(33, `  ⚠  Never commit .env.keys`))
    console.log('')
  },

  decrypt() {
    const targetFile = args[0] ?? '.env'
    const environment = args[1] ?? (process.env.NODE_ENV ?? 'development')
    const filePath = resolve(cwd, targetFile)
    if (!existsSync(filePath)) { console.log(c(31, `\n  ✖ File not found: ${filePath}\n`)); process.exit(1) }

    const privVar = `ENVAULT_PRIVATE_KEY_${environment.toUpperCase()}`
    const keyFilePath = resolve(cwd, '.env.keys')
    let privateKey = process.env[privVar]

    if (!privateKey && existsSync(keyFilePath)) {
      const keyVars = parseEnvFile(keyFilePath)
      privateKey = keyVars[privVar]
    }

    if (!privateKey) {
      console.log(c(31, `\n  ✖ Private key not found. Set ${privVar} in .env.keys or as an environment variable\n`))
      process.exit(1)
    }

    const content = readFileSync(filePath, 'utf-8')
    const vars = parseEnvFile(content)
    const outPath = args[2] ? resolve(cwd, args[2]) : filePath + '.decrypted'
    const lines = []
    let decryptedCount = 0

    for (const [key, val] of Object.entries(vars)) {
      if (key.startsWith('ENVAULT_PUBLIC_KEY')) continue
      if (val.startsWith(ENC_PREFIX)) {
        try {
          const plain = decryptValue(val, privateKey)
          lines.push(`${key}=${plain}`)
          decryptedCount++
        } catch {
          console.log(c(31, `  ✖ Failed to decrypt ${key} — invalid key or corrupted data`))
          process.exit(1)
        }
      } else {
        lines.push(`${key}=${val}`)
      }
    }

    writeFileSync(outPath, lines.join('\n') + '\n')
    console.log('')
    console.log(c(32, `  ✔ Decrypted ${decryptedCount} value${decryptedCount !== 1 ? 's' : ''} → ${relative(cwd, outPath)}`))
    console.log('')
  },

  rotate() {
    const targetFile = args[0] ?? '.env'
    const environment = args[1] ?? (process.env.NODE_ENV ?? 'development')
    const filePath = resolve(cwd, targetFile)
    if (!existsSync(filePath)) { console.log(c(31, `\n  ✖ File not found: ${filePath}\n`)); process.exit(1) }

    const privVar  = `ENVAULT_PRIVATE_KEY_${environment.toUpperCase()}`
    const keyFilePath = resolve(cwd, '.env.keys')
    let oldPrivateKey = process.env[privVar]
    if (!oldPrivateKey && existsSync(keyFilePath)) oldPrivateKey = parseEnvFile(keyFilePath)[privVar]

    if (!oldPrivateKey) { console.log(c(31, `\n  ✖ Cannot rotate — old private key not found: ${privVar}\n`)); process.exit(1) }

    const content = readFileSync(filePath, 'utf-8')
    const vars = parseEnvFile(content)

    const decrypted = {}
    for (const [key, val] of Object.entries(vars)) {
      if (key.startsWith('ENVAULT_PUBLIC_KEY')) continue
      decrypted[key] = val.startsWith(ENC_PREFIX) ? decryptValue(val, oldPrivateKey) : val
    }

    const { publicKey: newPublicKey, privateKey: newPrivateKey } = generateKeyPair()
    const lines = [
      '#/-------------------[ENVAULT_PUBLIC_KEY]--------------------/',
      '#/ public-key encryption for .env files                     /',
      '#/-----------------------------------------------------------/',
      `ENVAULT_PUBLIC_KEY_${environment.toUpperCase()}="${newPublicKey}"`,
      '',
    ]

    for (const [key, val] of Object.entries(decrypted)) {
      lines.push(`${key}="${encryptValue(val, newPublicKey)}"`)
    }

    writeFileSync(filePath, lines.join('\n') + '\n')

    if (existsSync(keyFilePath)) {
      const keyContent = readFileSync(keyFilePath, 'utf-8')
      const updated = keyContent.replace(new RegExp(`${privVar}="[^"]*"`), `${privVar}="${newPrivateKey}"`)
      writeFileSync(keyFilePath, updated.includes(privVar) ? updated : updated + `${privVar}="${newPrivateKey}"\n`)
    } else {
      writeFileSync(keyFilePath, `${privVar}="${newPrivateKey}"\n`)
    }

    console.log('')
    console.log(c(32, `  ✔ Key rotated successfully for ${targetFile} (${environment})`))
    console.log(c(90, '  New private key saved to .env.keys'))
    console.log('')
  },

  async health() {
    const targetFile = args[0] ?? '.env'
    const filePath = resolve(cwd, targetFile)
    const vars = parseEnvFile(filePath)

    console.log('')
    console.log(c(36, bold('  envault health')))
    console.log(c(90, `  Checking connectivity for URL and database variables...\n`))

    const urlKeys = []
    for (const [key, val] of Object.entries(vars)) {
      if (!val) continue
      try {
        const parsed = new URL(val)
        if (['http:', 'https:', ...DB_PROTOCOLS].some(p => parsed.protocol === p)) {
          urlKeys.push({ key, val, parsed })
        }
      } catch {}
    }

    if (urlKeys.length === 0) {
      console.log(c(90, '  No URL variables found to check'))
      console.log('')
      return
    }

    const results = await Promise.allSettled(urlKeys.map(async ({ key, val, parsed }) => {
      const start = Date.now()
      if (DB_PROTOCOLS.has(parsed.protocol)) {
        const port = parseInt(parsed.port) || getDefaultDbPort(parsed.protocol)
        if (!port) return { key, val, status: 'skip', error: 'Unknown protocol' }
        const result = await checkTcp(parsed.hostname, port)
        return { key, val, ...result, responseTime: Date.now() - start }
      } else {
        const result = await checkUrl(val)
        return { key, val, ...result }
      }
    }))

    let passed = 0
    let failed = 0
    for (const r of results) {
      if (r.status !== 'fulfilled') continue
      const { key, status, statusCode, responseTime, error } = r.value
      const icon = status === 'ok' ? c(32, '✔') : status === 'timeout' ? c(33, '⏱') : status === 'skip' ? c(90, '–') : c(31, '✖')
      const timeStr = responseTime !== undefined ? c(90, ` ${responseTime}ms`) : ''
      const statusStr = status === 'ok' ? c(32, statusCode ? `HTTP ${statusCode}` : 'tcp:ok') : c(31, error ?? status)
      console.log(`  ${icon}  ${c(33, key.padEnd(32))}${statusStr}${timeStr}`)
      if (status === 'ok') passed++
      else if (status !== 'skip') failed++
    }

    console.log('')
    if (failed === 0) console.log(c(32, `  ✔ All ${passed} check${passed !== 1 ? 's' : ''} passed`))
    else console.log(c(31, `  ✖ ${failed} of ${passed + failed} check${passed + failed !== 1 ? 's' : ''} failed`))
    console.log('')
  },

  run() {
    if (args.length === 0) { console.log(c(31, '\n  Usage: envault run [--env <file>] -- <command> [args...]\n')); process.exit(1) }

    let envFile = '.env'
    let cmdStart = 0

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--env' && args[i + 1]) { envFile = args[i + 1]; cmdStart = i + 2; break }
      if (args[i] === '--') { cmdStart = i + 1; break }
      if (i === 0 && !args[i].startsWith('-')) { break }
    }

    const filePath = resolve(cwd, envFile)
    const fileVars = parseEnvFile(filePath)
    const injectedEnv = { ...process.env, ...fileVars }

    const cmdArgs = args.slice(cmdStart)
    if (cmdArgs.length === 0) { console.log(c(31, '\n  ✖ No command specified after --\n')); process.exit(1) }

    const [cmd, ...rest] = cmdArgs
    const result = spawnSync(cmd, rest, { env: injectedEnv, stdio: 'inherit', shell: true })
    process.exit(result.status ?? 0)
  },

  onboard() {
    console.log('')
    console.log(c(36, bold('  envault onboard')))
    console.log(c(90, '  Detecting your stack...\n'))

    const pkg = readPackageJson()
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    const allDeps = Object.keys(deps)

    const framework = detectFramework()
    const isTS = existsSync(join(cwd, 'tsconfig.json')) || allDeps.includes('typescript')
    const ext = isTS ? 'ts' : 'js'
    const envOutPath = resolve(cwd, `env.${ext}`)

    const detectedServices = []
    const presetNames = []

    if (existsSync(join(cwd, 'vercel.json')) || process.env.VERCEL) presetNames.push('vercel')
    else if (existsSync(join(cwd, 'railway.toml'))) presetNames.push('railway')
    else if (existsSync(join(cwd, 'fly.toml'))) presetNames.push('fly')
    else if (existsSync(join(cwd, 'netlify.toml'))) presetNames.push('netlify')
    else if (existsSync(join(cwd, 'render.yaml'))) presetNames.push('render')
    else presetNames.push('node')

    const serviceMap = {
      '@supabase/supabase-js': 'supabase', 'stripe': 'stripe', '@clerk/nextjs': 'clerk',
      '@clerk/clerk-sdk-node': 'clerk', 'openai': 'openai', '@anthropic-ai/sdk': 'anthropic',
      'resend': 'resend', '@sendgrid/mail': 'sendgrid', 'twilio': 'twilio',
      '@sentry/node': 'sentry', 'pusher': 'pusher', '@upstash/redis': 'upstash',
      '@aws-sdk/client-s3': 'aws', 'ioredis': 'redis', 'mongoose': 'mongodb',
      '@neondatabase/serverless': 'neon', '@planetscale/database': 'planetscale',
      '@lemonsqueezy/lemonsqueezy.js': 'lemonsqueezy',
    }

    for (const [dep, preset] of Object.entries(serviceMap)) {
      if (allDeps.includes(dep)) { presetNames.push(preset); detectedServices.push(dep) }
    }

    const hasPg = allDeps.includes('pg') || allDeps.includes('@prisma/client') || allDeps.includes('drizzle-orm')
    if (hasPg && !presetNames.includes('supabase') && !presetNames.includes('neon') && !presetNames.includes('planetscale')) {
      presetNames.push('database')
    }

    if (!presetNames.includes('clerk')) presetNames.push('auth')

    const uniquePresets = [...new Set(presetNames)]
    const importPath = '@jadendev/envault'
    const lines = []

    if (framework === 'next') {
      lines.push(`import { createNextEnv, str, num, bool, url, secret, enm } from '${importPath}/next'`)
      lines.push(`import { presets } from '${importPath}/presets'`)
      lines.push('')
      lines.push('export const env = createNextEnv({')
      lines.push('  server: {')
      for (const p of uniquePresets.filter(p => !['vercel', 'netlify'].includes(p))) lines.push(`    ...presets.${p},`)
      lines.push('  },')
      lines.push('  client: {')
      lines.push("    NEXT_PUBLIC_APP_URL: url(),")
      lines.push('  },')
      lines.push('})')
    } else if (framework === 'vite') {
      lines.push(`import { createEnv, str, num, bool, url, secret, enm } from '${importPath}/vite'`)
      lines.push(`import { presets } from '${importPath}/presets'`)
      lines.push('')
      lines.push('export const env = createEnv({')
      for (const p of uniquePresets) lines.push(`  ...presets.${p},`)
      lines.push("  VITE_APP_TITLE: str({ default: 'My App' }),")
      lines.push('})')
    } else {
      lines.push(`import { envault, str, num, bool, url, secret, enm } from '${importPath}'`)
      lines.push(`import { presets } from '${importPath}/presets'`)
      lines.push('')
      lines.push('export const env = envault({')
      for (const p of uniquePresets) lines.push(`  ...presets.${p},`)
      lines.push('})')
    }

    lines.push('')

    if (!existsSync(envOutPath)) {
      writeFileSync(envOutPath, lines.join('\n'))
      console.log(c(32, `  ✔ Created env.${ext}`))
    } else {
      console.log(c(33, `  ⚠  env.${ext} already exists — skipped`))
    }

    if (framework) console.log(c(90, `  Framework: ${framework}`))
    if (detectedServices.length > 0) console.log(c(90, `  Services: ${detectedServices.join(', ')}`))
    console.log(c(90, `  Presets: ${uniquePresets.join(', ')}`))
    console.log('')
  },

  init() {
    const outPath = resolve(cwd, 'env.ts')
    if (existsSync(outPath)) { console.log(c(33, '\n  ⚠  env.ts already exists — delete it first to reinitialise\n')); process.exit(0) }

    const codeUsage = findEnvUsageInCode()
    const envVars = parseEnvFile(resolve(cwd, '.env'))
    const allKeys = [...new Set([...codeUsage.keys(), ...Object.keys(envVars)])].sort()

    const prefixGroups = new Map()
    for (const key of allKeys) {
      const parts = key.split('_')
      if (parts.length >= 3) {
        const prefix = parts[0]
        if (!prefixGroups.has(prefix)) prefixGroups.set(prefix, [])
        prefixGroups.get(prefix).push(key)
      }
    }

    const groupedKeys = new Set()
    for (const [, keys] of prefixGroups) if (keys.length >= 2) for (const k of keys) groupedKeys.add(k)

    const lines = [
      "import { envault, str, num, bool, url, port, email, json, list, uuid, secret, date, phone, semver, ip, hex, cidr, jwt, base64, slug, locale, timezone, cron, duration, filepath, hash, creditcard, iban, latitude, longitude, country, currency, mimetype, enm } from '@jadendev/envault'",
      '',
      'export const env = envault({',
    ]

    const writtenPrefixes = new Set()
    for (const [prefix, keys] of prefixGroups) {
      if (keys.length < 2 || writtenPrefixes.has(prefix)) continue
      writtenPrefixes.add(prefix)
      lines.push(`  ${prefix.toLowerCase()}: {`)
      for (const key of keys.sort()) {
        lines.push(`    ${key.slice(prefix.length + 1)}: ${guessType(key)},`)
      }
      lines.push(`  },`)
    }

    for (const key of allKeys) {
      if (groupedKeys.has(key)) continue
      lines.push(`  ${key}: ${guessType(key)},`)
    }

    lines.push('})', '')

    writeFileSync(outPath, lines.join('\n'))
    console.log('')
    console.log(c(32, `  ✔ Generated env.ts with ${allKeys.length} variable${allKeys.length !== 1 ? 's' : ''}`))
    console.log(c(90, `     Review types and add options (optional, default, etc.) as needed`))
    console.log('')
  },

  docs() {
    const envSchemaFile = args[0] ?? 'env.ts'
    const format = args[1] ?? 'markdown'
    const outFile = args[2] ?? (format === 'html' ? 'env-docs.html' : format === 'json' ? 'env-docs.json' : 'ENV.md')

    const schemaPath = resolve(cwd, envSchemaFile)
    if (!existsSync(schemaPath)) { console.log(c(31, `\n  ✖ Schema file not found: ${schemaPath}\n  Run \`envault init\` first to generate env.ts\n`)); process.exit(1) }

    const envFile = resolve(cwd, '.env')
    const vars = parseEnvFile(envFile)
    const keys = Object.keys(vars)

    const content = readFileSync(schemaPath, 'utf-8')
    const typeMap = {}
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*([A-Z_][A-Z0-9_]*):\s*(\w+)\(/)
      if (match) typeMap[match[1]] = match[2]
    }

    let out = ''

    if (format === 'html') {
      const rows = keys.map(key => {
        const val = vars[key]
        const type = typeMap[key] ?? 'str'
        const sensitive = isSecret(key)
        const display = sensitive ? maskValue(val) : (val || '')
        return `<tr><td><code>${key}</code></td><td><code>${type}</code></td><td>${display}</td><td>${sensitive ? '🔒' : ''}</td></tr>`
      }).join('\n')

      out = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Environment Variables</title><style>body{font-family:-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;padding:40px}table{width:100%;border-collapse:collapse}th,td{padding:12px;text-align:left;border-bottom:1px solid #1e293b}th{color:#64748b;font-size:12px;text-transform:uppercase}code{background:#1e293b;padding:2px 6px;border-radius:4px;font-size:13px}</style></head><body><h1 style="color:#38bdf8">Environment Variables</h1><table><thead><tr><th>Variable</th><th>Type</th><th>Value</th><th></th></tr></thead><tbody>${rows}</tbody></table></body></html>`
    } else if (format === 'json') {
      const data = keys.map(key => ({ key, type: typeMap[key] ?? 'str', sensitive: isSecret(key), hasValue: !!vars[key] }))
      out = JSON.stringify(data, null, 2)
    } else {
      const lines = ['# Environment Variables', '', `| Variable | Type | Required | Description |`, `|:--|:--|:--|:--|`]
      for (const key of keys) {
        const type = typeMap[key] ?? 'str'
        const required = !vars[key] ? '✅' : '⬜'
        lines.push(`| \`${key}\` | \`${type}\` | ${required} | |`)
      }
      out = lines.join('\n') + '\n'
    }

    writeFileSync(resolve(cwd, outFile), out)
    console.log('')
    console.log(c(32, `  ✔ Generated ${outFile} (${format})`))
    console.log('')
  },

  generate_secret() {
    const length = parseInt(args[0] ?? '32')
    const type = args[1] ?? 'random'

    let secret
    if (type === 'api-key') {
      const prefix = args[2] ?? 'sk'
      secret = generateApiKey(prefix, length)
    } else if (type === 'hex') {
      secret = randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length)
    } else if (type === 'base64') {
      secret = randomBytes(length).toString('base64').slice(0, length)
    } else if (type === 'numeric') {
      const bytes = randomBytes(length)
      secret = Array.from(bytes).map(b => b % 10).join('').slice(0, length)
    } else {
      secret = generateSecureSecret(length)
    }

    const { score, level, color, bits } = scoreSecret(secret)

    console.log('')
    console.log(c(36, bold('  envault generate-secret')))
    console.log('')
    console.log(`  ${c(33, 'Value:')}  ${secret}`)
    console.log(`  ${c(33, 'Length:')} ${secret.length} characters`)
    console.log(`  ${c(33, 'Bits:')}   ~${bits} bits of entropy`)
    console.log(`  ${c(33, 'Score:')}  ${c(color, level)} (${score}/100)`)
    console.log('')
  },

  'install-hook'() {
    const hookPath = resolve(cwd, '.git', 'hooks', 'pre-commit')
    if (!existsSync(resolve(cwd, '.git'))) { console.log(c(31, '\n  ✖ Not a git repository\n')); process.exit(1) }

    const hookScript = [
      '#!/bin/sh',
      '# envault pre-commit hook',
      '',
      'ENVAULT_CHECK=$(npx @jadendev/envault audit 2>/dev/null)',
      'if [ $? -ne 0 ]; then',
      '  echo ""',
      '  echo "\\033[31m  ✖ envault: env issues found\\033[0m"',
      '  exit 1',
      'fi',
      '',
      'exit 0',
    ].join('\n')
    mkdirSync(dirname(hookPath), { recursive: true })
    writeFileSync(hookPath, hookScript)
    chmodSync(hookPath, '755')

    console.log('')
    console.log(c(32, '  ✔ Pre-commit hook installed at .git/hooks/pre-commit'))
    console.log(c(90, '  The hook will run `envault audit` before every commit'))
    console.log(c(90, '  and block commits that contain possible secrets in staged files'))
    console.log('')
  },

  scan() {
    console.log('')
    console.log(c(36, bold('  envault scan')))
    console.log(c(90, '  Deep scan for secrets and environment variable issues...\n'))

    const files = walkDir(cwd)
    const issues = []

    const sensitivePatterns = [
      { pattern: /(?:password|passwd|pwd)\s*[=:]\s*["']?([^\s"']+)/gi, label: 'Hardcoded password' },
      { pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*["']?([a-zA-Z0-9_\-]{20,})/gi, label: 'Hardcoded API key' },
      { pattern: /sk-[a-zA-Z0-9]{32,}/g, label: 'OpenAI API key' },
      { pattern: /ghp_[a-zA-Z0-9]{36}/g, label: 'GitHub token' },
      { pattern: /xox[baprs]-[a-zA-Z0-9-]+/g, label: 'Slack token' },
      { pattern: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, label: 'JWT token' },
      { pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, label: 'Private key' },
      { pattern: /(?:postgres|mysql|mongodb):\/\/[^:]+:[^@]+@/g, label: 'Database URL with credentials' },
    ]

    for (const file of files) {
      let content
      try { content = readFileSync(file, 'utf-8') } catch { continue }
      const rel = relative(cwd, file)

      for (const { pattern, label } of sensitivePatterns) {
        pattern.lastIndex = 0
        if (pattern.test(content)) {
          issues.push({ file: rel, label })
        }
      }
    }

    if (issues.length === 0) {
      console.log(c(32, '  ✔ No hardcoded secrets found'))
    } else {
      console.log(c(31, `  ✖ Found ${issues.length} potential secret${issues.length !== 1 ? 's' : ''}:\n`))
      for (const { file, label } of issues) {
        console.log(`  ${c(31, '●')} ${c(33, label.padEnd(36))}${c(90, file)}`)
      }
    }
    console.log('')
  },

  stats() {
    console.log('')
    console.log(c(36, bold('  envault stats')))
    console.log('')

    const envFiles = ['.env', '.env.local', '.env.development', '.env.production', '.env.staging']
      .map(f => resolve(cwd, f)).filter(f => existsSync(f))

    let totalVars = 0, totalSecrets = 0, totalUrls = 0, totalEmpty = 0

    for (const f of envFiles) {
      const vars = parseEnvFile(f)
      totalVars += Object.keys(vars).length
      totalSecrets += Object.keys(vars).filter(k => isSecret(k)).length
      totalUrls += Object.values(vars).filter(v => { try { new URL(v); return true } catch { return false } }).length
      totalEmpty += Object.values(vars).filter(v => !v).length
    }

    const framework = detectFramework()
    const pkg = readPackageJson()

    console.log(`  ${c(33, 'Package:')}     ${pkg.name ?? '(unnamed)'} v${pkg.version ?? '0.0.0'}`)
    console.log(`  ${c(33, 'Framework:')}   ${framework ?? 'None detected'}`)
    console.log(`  ${c(33, 'Env files:')}   ${envFiles.length}`)
    console.log(`  ${c(33, 'Total vars:')}  ${totalVars}`)
    console.log(`  ${c(33, 'Secrets:')}     ${totalSecrets}`)
    console.log(`  ${c(33, 'URLs:')}        ${totalUrls}`)
    console.log(`  ${c(33, 'Empty:')}       ${totalEmpty}`)
    console.log('')
  },

  completions() {
    const shell = args[0] ?? 'bash'
    const commandList = Object.keys(commands).join(' ')

    if (shell === 'bash' || shell === 'zsh') {
      const script = `
_envault_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local commands="${commandList}"
  COMPREPLY=($(compgen -W "$commands" -- "$cur"))
}
complete -F _envault_completions envault
`
      process.stdout.write(script)
    } else if (shell === 'fish') {
      const commands_list = Object.keys(commands).map(cmd => `complete -c envault -f -a '${cmd}'`).join('\n')
      process.stdout.write(commands_list + '\n')
    } else {
      console.log(c(31, `\n  Unknown shell: ${shell}. Supported: bash, zsh, fish\n`))
    }
  },

  lint() {
    const schemaFile = args[0] ?? 'env.ts'
    const schemaPath = resolve(cwd, schemaFile)

    if (!existsSync(schemaPath)) {
      console.log(c(31, `\n  ✖ Schema file not found: ${schemaFile}\n`))
      process.exit(1)
    }

    const content = readFileSync(schemaPath, 'utf-8')
    const issues = []

    if (!content.includes('envault') && !content.includes('createNextEnv') && !content.includes('createEnv')) {
      issues.push('No envault() call found — schema may not be initialized')
    }

    if (!content.includes('export const env') && !content.includes('export default')) {
      issues.push('env object is not exported — import it with `import { env } from "./env"`')
    }

    const strFields = content.match(/:\s*str\(\)/g) ?? []
    if (strFields.length > 0) {
      issues.push(`${strFields.length} field${strFields.length > 1 ? 's use' : ' uses'} bare str() — consider adding description(), minLength(), or choices()`)
    }

    console.log('')
    console.log(c(36, bold(`  envault lint ${c(90, schemaFile)}`)))
    console.log('')

    if (issues.length === 0) {
      console.log(c(32, '  ✔ Schema looks good'))
    } else {
      for (const issue of issues) {
        console.log(`  ${c(33, '⚠')}  ${issue}`)
      }
    }
    console.log('')
  },
}

const help = `
${c(36, bold('envault'))} — environment variable validation CLI

${c(33, 'Usage:')}
  envault <command> [options]

${c(33, 'Validation:')}
  ${c(32, 'check')}                    Verify .env exists and report stats
  ${c(32, 'validate')} <file>          Parse and lint a specific env file
  ${c(32, 'audit')}                    Find missing vars, stale vars, and secret leaks
  ${c(32, 'lint')} [schema]            Lint your env.ts schema file
  ${c(32, 'scan')}                     Deep scan codebase for hardcoded secrets

${c(33, 'Inspection:')}
  ${c(32, 'doctor')}                   Show all variables across all .env files
  ${c(32, 'diff')} [a] [b]             Compare two env files
  ${c(32, 'secrets')}                  List all secrets with strength scoring
  ${c(32, 'stats')}                    Project environment statistics
  ${c(32, 'health')} [file]            Check URL and database connectivity

${c(33, 'Generation:')}
  ${c(32, 'init')}                     Scaffold env.ts from your codebase
  ${c(32, 'onboard')}                  Auto-detect stack and scaffold env.ts + presets
  ${c(32, 'generate')} [out]           Create .env.example from .env
  ${c(32, 'docs')} [schema] [format]   Generate documentation (markdown/html/json)
  ${c(32, 'generate-secret')} [len]    Generate a cryptographically secure secret

${c(33, 'Encryption:')}
  ${c(32, 'encrypt')} [file] [env]     Encrypt .env values with public-key encryption
  ${c(32, 'decrypt')} [file] [env]     Decrypt an encrypted .env file
  ${c(32, 'rotate')} [file] [env]      Rotate encryption keys

${c(33, 'Utilities:')}
  ${c(32, 'run')} -- <cmd>             Inject .env into a subprocess
  ${c(32, 'watch')} [file]             Watch an env file for live changes
  ${c(32, 'copy')} <src> <dst>         Copy missing vars between env files
  ${c(32, 'export')} [file] [format]   Print env file (json/shell/yaml/docker/github)
  ${c(32, 'install-hook')}             Install git pre-commit hook
  ${c(32, 'completions')} [shell]      Generate shell completions (bash/zsh/fish)

${c(33, 'Examples:')}
  envault check
  envault audit
  envault encrypt .env production
  envault run -- node dist/index.js
  envault diff .env .env.staging
  envault export .env --shell >> ~/.zshrc
  envault generate-secret 64 api-key sk
  envault health .env.production
  envault completions bash >> ~/.bashrc
`

if (commands[command]) {
  Promise.resolve(commands[command]()).catch(e => { console.error(c(31, `\n  ✖ ${e.message}\n`)); process.exit(1) })
} else {
  process.stdout.write(help)
  if (command) process.exit(1)
}
