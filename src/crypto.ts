import { createCipheriv, createDecipheriv, generateKeyPairSync, createECDH, randomBytes, createHmac, createHash, scryptSync, timingSafeEqual } from 'crypto'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const CURVE = 'prime256v1'
const AES_ALGO = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 12
const TAG_LENGTH = 16
const SALT_LENGTH = 32
const SCRYPT_N = 32768
const SCRYPT_R = 8
const SCRYPT_P = 1
const ENCRYPTED_PREFIX = 'enc:'
const KEY_FILE_NAME = '.env.keys'
const HEADER_LINE = '#/-------------------[ENVAULT_PUBLIC_KEY]--------------------/'
const SUBHEADER = '#/ public-key encryption for .env files                     /'
const FOOTER = '#/-----------------------------------------------------------/'
const KEYS_HEADER = '#/------------------!ENVAULT_PRIVATE_KEYS!------------------/'
const KEYS_SUBHEADER = '#/ private decryption keys. DO NOT commit to source control  /'
const KEYS_FOOTER = '#/-----------------------------------------------------------/'

const COMMON_WEAK_PASSWORDS = new Set([
  'password', 'password123', 'secret', 'changeme', 'admin', 'letmein',
  'welcome', '123456', 'qwerty', 'abc123', 'master', 'pass', 'test',
  'temp', 'default', 'root', 'guest', 'login', 'monkey', 'dragon',
  'baseball', 'football', 'shadow', 'master', 'hello', 'superman',
  'batman', 'trustno1', 'iloveyou', '1234567890', 'passw0rd',
])

export interface KeyPair {
  publicKey: string
  privateKey: string
  environment: string
}

export interface EncryptedFile {
  publicKey: string
  environment: string
  vars: Record<string, string>
}

export interface EntropyResult {
  score: number
  level: 'critical' | 'weak' | 'fair' | 'strong' | 'excellent'
  entropy: number
  length: number
  hasUppercase: boolean
  hasLowercase: boolean
  hasDigits: boolean
  hasSpecial: boolean
  isCommonPassword: boolean
  suggestions: string[]
}

export interface EncryptResult {
  encryptedContent: string
  publicKey: string
  privateKey: string
  keyFileContent: string
}

export interface DecryptResult {
  vars: Record<string, string>
  environment: string
}

function shannonEntropy(str: string): number {
  const freq: Record<string, number> = {}
  for (const ch of str) freq[ch] = (freq[ch] ?? 0) + 1
  const len = str.length
  return -Object.values(freq).reduce((acc, count) => {
    const p = count / len
    return acc + p * Math.log2(p)
  }, 0)
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P })
}

function encryptValue(plaintext: string, publicKeyPem: string): string {
  const ecdh = createECDH(CURVE)
  ecdh.generateKeys()
  const ephemeralPublicKey = ecdh.getPublicKey('hex', 'uncompressed')

  const importedKey = Buffer.from(publicKeyPem, 'base64')
  const sharedSecret = ecdh.computeSecret(importedKey)

  const salt = randomBytes(SALT_LENGTH)
  const derivedKey = deriveKey(sharedSecret.toString('hex'), salt)

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(AES_ALGO, derivedKey, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  const payload = Buffer.concat([
    Buffer.from(ephemeralPublicKey, 'hex'),
    salt,
    iv,
    tag,
    encrypted,
  ])

  return ENCRYPTED_PREFIX + payload.toString('base64')
}

function decryptValue(ciphertext: string, privateKeyPem: string): string {
  if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) return ciphertext

  const payload = Buffer.from(ciphertext.slice(ENCRYPTED_PREFIX.length), 'base64')

  const ephemeralPubKeyLength = 65
  const ephemeralPublicKey = payload.subarray(0, ephemeralPubKeyLength)
  const salt = payload.subarray(ephemeralPubKeyLength, ephemeralPubKeyLength + SALT_LENGTH)
  const iv = payload.subarray(ephemeralPubKeyLength + SALT_LENGTH, ephemeralPubKeyLength + SALT_LENGTH + IV_LENGTH)
  const tag = payload.subarray(ephemeralPubKeyLength + SALT_LENGTH + IV_LENGTH, ephemeralPubKeyLength + SALT_LENGTH + IV_LENGTH + TAG_LENGTH)
  const encrypted = payload.subarray(ephemeralPubKeyLength + SALT_LENGTH + IV_LENGTH + TAG_LENGTH)

  const ecdh = createECDH(CURVE)
  ecdh.setPrivateKey(Buffer.from(privateKeyPem, 'base64'))
  const sharedSecret = ecdh.computeSecret(ephemeralPublicKey)

  const derivedKey = deriveKey(sharedSecret.toString('hex'), salt)

  const decipher = createDecipheriv(AES_ALGO, derivedKey, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export function generateKeyPair(environment: string = 'development'): KeyPair {
  const ecdh = createECDH(CURVE)
  ecdh.generateKeys()
  const publicKey = ecdh.getPublicKey('base64', 'uncompressed')
  const privateKey = ecdh.getPrivateKey('base64')
  return { publicKey, privateKey, environment }
}

export function encryptEnvFile(
  content: string,
  environment: string = 'development',
  existingPublicKey?: string,
  existingPrivateKey?: string
): EncryptResult {
  const { publicKey, privateKey } = existingPublicKey && existingPrivateKey
    ? { publicKey: existingPublicKey, privateKey: existingPrivateKey }
    : generateKeyPair(environment)

  const vars = parseEnvContent(content)
  const encryptedVars: Record<string, string> = {}

  for (const [key, value] of Object.entries(vars)) {
    if (value && !value.startsWith(ENCRYPTED_PREFIX)) {
      encryptedVars[key] = encryptValue(value, publicKey)
    } else {
      encryptedVars[key] = value
    }
  }

  const lines: string[] = [
    HEADER_LINE,
    SUBHEADER,
    FOOTER,
    `ENVAULT_PUBLIC_KEY_${environment.toUpperCase()}="${publicKey}"`,
    '',
  ]

  const originalLines = content.split('\n')
  for (const line of originalLines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('ENVAULT_PUBLIC_KEY')) {
      if (trimmed.startsWith('#') || !trimmed) lines.push(line)
      continue
    }
    const eq = line.indexOf('=')
    if (eq === -1) { lines.push(line); continue }
    const key = line.slice(0, eq).trim()
    if (encryptedVars[key] !== undefined) {
      lines.push(`${key}="${encryptedVars[key]}"`)
    } else {
      lines.push(line)
    }
  }

  const keyFileLines = [
    KEYS_HEADER,
    KEYS_SUBHEADER,
    KEYS_FOOTER,
    ``,
    `# .env.${environment}`,
    `ENVAULT_PRIVATE_KEY_${environment.toUpperCase()}="${privateKey}"`,
    '',
  ]

  return {
    encryptedContent: lines.join('\n'),
    publicKey,
    privateKey,
    keyFileContent: keyFileLines.join('\n'),
  }
}

export function decryptEnvFile(
  content: string,
  privateKey: string,
  environment: string = 'development'
): DecryptResult {
  const vars = parseEnvContent(content)
  const decrypted: Record<string, string> = {}

  for (const [key, value] of Object.entries(vars)) {
    if (key.startsWith('ENVAULT_PUBLIC_KEY')) continue
    if (value.startsWith(ENCRYPTED_PREFIX)) {
      try {
        decrypted[key] = decryptValue(value, privateKey)
      } catch {
        throw new Error(`Failed to decrypt ${key} — invalid private key or corrupted value`)
      }
    } else {
      decrypted[key] = value
    }
  }

  return { vars: decrypted, environment }
}

export function loadEncryptedEnvFile(
  filePath: string,
  environment: string = 'development'
): Record<string, string> {
  if (!existsSync(filePath)) return {}

  const content = readFileSync(filePath, 'utf-8')
  const vars = parseEnvContent(content)

  const publicKeyVar = `ENVAULT_PUBLIC_KEY_${environment.toUpperCase()}`
  if (!vars[publicKeyVar] && !Object.keys(vars).some(k => k.startsWith('ENVAULT_PUBLIC_KEY'))) {
    return vars
  }

  const envKey = process.env[`ENVAULT_PRIVATE_KEY_${environment.toUpperCase()}`]
  if (!envKey) return {}

  try {
    const result = decryptEnvFile(content, envKey, environment)
    return result.vars
  } catch {
    return {}
  }
}

export function measureEntropy(value: string): EntropyResult {
  const entropy = shannonEntropy(value) * value.length / 8
  const hasUppercase = /[A-Z]/.test(value)
  const hasLowercase = /[a-z]/.test(value)
  const hasDigits = /[0-9]/.test(value)
  const hasSpecial = /[^A-Za-z0-9]/.test(value)
  const isCommonPassword = COMMON_WEAK_PASSWORDS.has(value.toLowerCase())

  const charsetSize = (hasUppercase ? 26 : 0) + (hasLowercase ? 26 : 0) + (hasDigits ? 10 : 0) + (hasSpecial ? 32 : 0)
  const bitsOfEntropy = value.length * Math.log2(Math.max(charsetSize, 1))

  let score = 0
  if (value.length >= 8) score += 10
  if (value.length >= 16) score += 15
  if (value.length >= 32) score += 25
  if (hasUppercase) score += 10
  if (hasLowercase) score += 10
  if (hasDigits) score += 10
  if (hasSpecial) score += 15
  if (!isCommonPassword) score += 5
  if (bitsOfEntropy >= 60) score += 20
  if (isCommonPassword) score = Math.min(score, 20)

  const suggestions: string[] = []
  if (value.length < 16) suggestions.push('Use at least 16 characters')
  if (!hasUppercase) suggestions.push('Add uppercase letters')
  if (!hasLowercase) suggestions.push('Add lowercase letters')
  if (!hasDigits) suggestions.push('Add numbers')
  if (!hasSpecial) suggestions.push('Add special characters (!@#$%^&*)')
  if (isCommonPassword) suggestions.push('This is a commonly known password — change it immediately')
  if (bitsOfEntropy < 40) suggestions.push('Add more randomness — consider using a password generator')

  const level: EntropyResult['level'] =
    score >= 90 ? 'excellent'
    : score >= 70 ? 'strong'
    : score >= 50 ? 'fair'
    : score >= 30 ? 'weak'
    : 'critical'

  return {
    score,
    level,
    entropy: Math.round(bitsOfEntropy * 10) / 10,
    length: value.length,
    hasUppercase,
    hasLowercase,
    hasDigits,
    hasSpecial,
    isCommonPassword,
    suggestions,
  }
}

export function rotateKey(
  encryptedContent: string,
  oldPrivateKey: string,
  environment: string = 'development'
): EncryptResult {
  const decrypted = decryptEnvFile(encryptedContent, oldPrivateKey, environment)
  const plainContent = Object.entries(decrypted.vars)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  return encryptEnvFile(plainContent, environment)
}

export function signValue(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex')
}

export function verifySignature(value: string, signature: string, secret: string): boolean {
  const expected = Buffer.from(createHmac('sha256', secret).update(value).digest('hex'))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}

export function hashValue(value: string, algorithm: string = 'sha256'): string {
  return createHash(algorithm).update(value).digest('hex')
}

export function generateSecureSecret(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  const bytes = randomBytes(length)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length]
  }
  return result
}

export function generateApiKey(prefix: string = 'sk', length: number = 32): string {
  const random = randomBytes(length).toString('hex')
  return `${prefix}_${random}`
}

function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  const lines = content.split('\n')
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
    } else {
      const ci = raw.indexOf(' #')
      if (ci !== -1) raw = raw.slice(0, ci)
      raw = raw.trim()
    }

    result[key] = raw
  }

  return result
}

export function saveKeyFile(keys: KeyPair[], cwd: string = process.cwd()): void {
  const keyFilePath = resolve(cwd, KEY_FILE_NAME)
  const existingContent = existsSync(keyFilePath) ? readFileSync(keyFilePath, 'utf-8') : ''
  const existingKeys = parseEnvContent(existingContent)

  const lines = [KEYS_HEADER, KEYS_SUBHEADER, KEYS_FOOTER, '']

  for (const { privateKey, environment } of keys) {
    const varName = `ENVAULT_PRIVATE_KEY_${environment.toUpperCase()}`
    existingKeys[varName] = privateKey
  }

  for (const [key, value] of Object.entries(existingKeys)) {
    lines.push(`${key}="${value}"`)
  }

  lines.push('')
  writeFileSync(keyFilePath, lines.join('\n'), 'utf-8')
}

export function loadKeyFile(cwd: string = process.cwd()): Record<string, string> {
  const keyFilePath = resolve(cwd, KEY_FILE_NAME)
  if (!existsSync(keyFilePath)) return {}
  return parseEnvContent(readFileSync(keyFilePath, 'utf-8'))
}

export function isEncryptedFile(content: string): boolean {
  return content.includes('ENVAULT_PUBLIC_KEY') || content.includes(ENCRYPTED_PREFIX)
}

export function isEncryptedValue(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX)
}
