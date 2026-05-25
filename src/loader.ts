import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

interface LoadOptions {
  path?: string | string[]
  override?: boolean
  environment?: string
}

interface ParsedEnv {
  [key: string]: string
}

interface InterpolationContext {
  [key: string]: string | undefined
}

function interpolateValue(value: string, context: InterpolationContext): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, key) => context[key] ?? process.env[key] ?? '')
    .replace(/\$([A-Z_][A-Z0-9_]*)/g, (_, key) => context[key] ?? process.env[key] ?? '')
}

export function parseEnvContent(content: string, allowInterpolation: boolean = false): ParsedEnv {
  const result: ParsedEnv = {}
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
    let isQuoted = false

    if (raw.startsWith('"')) {
      isQuoted = true
      let inner = raw.slice(1)
      while (!inner.endsWith('"') && i < lines.length) {
        inner += '\n' + lines[i]
        i++
      }
      raw = inner.endsWith('"') ? inner.slice(0, -1) : inner
      raw = raw
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .replace(/\\0/g, '\0')
    } else if (raw.startsWith("'")) {
      isQuoted = true
      let inner = raw.slice(1)
      while (!inner.endsWith("'") && i < lines.length) {
        inner += '\n' + lines[i]
        i++
      }
      raw = inner.endsWith("'") ? inner.slice(0, -1) : inner
    } else if (raw.startsWith('`')) {
      isQuoted = true
      let inner = raw.slice(1)
      while (!inner.endsWith('`') && i < lines.length) {
        inner += '\n' + lines[i]
        i++
      }
      raw = inner.endsWith('`') ? inner.slice(0, -1) : inner
    } else {
      const commentIdx = raw.indexOf(' #')
      if (commentIdx !== -1) raw = raw.slice(0, commentIdx)
      raw = raw.trim()
    }

    if (allowInterpolation && !isQuoted) {
      raw = interpolateValue(raw, result)
    }

    result[key] = raw
  }

  return result
}

function readEnvFile(filePath: string): ParsedEnv {
  if (!existsSync(filePath)) return {}
  try {
    return parseEnvContent(readFileSync(filePath, 'utf-8'), true)
  } catch {
    return {}
  }
}

function buildFilePaths(options: LoadOptions): string[] {
  const cwd = process.cwd()
  const env = options.environment ?? process.env.NODE_ENV ?? 'development'

  if (options.path) {
    const paths = Array.isArray(options.path) ? options.path : [options.path]
    return paths.map(p => resolve(cwd, p))
  }

  return [
    resolve(cwd, '.env'),
    resolve(cwd, `.env.${env}`),
    resolve(cwd, '.env.local'),
    resolve(cwd, `.env.${env}.local`),
  ]
}

export function loadEnvFiles(options: LoadOptions = {}): ParsedEnv {
  const filePaths = buildFilePaths(options)
  let merged: ParsedEnv = {}

  for (const filePath of filePaths) {
    const vars = readEnvFile(filePath)

    if (options.override) {
      merged = { ...merged, ...vars }
    } else {
      for (const [k, v] of Object.entries(vars)) {
        if (!(k in merged)) merged[k] = v
      }
    }
  }

  return merged
}

export function loadEnvString(content: string): ParsedEnv {
  return parseEnvContent(content, true)
}

export function serializeEnvFile(vars: ParsedEnv): string {
  const lines: string[] = []

  for (const [key, value] of Object.entries(vars)) {
    const needsQuotes = value.includes('\n') || value.includes('"') || value.includes(' ') || value.includes('#')
    if (needsQuotes) {
      const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t')
      lines.push(`${key}="${escaped}"`)
    } else {
      lines.push(`${key}=${value}`)
    }
  }

  return lines.join('\n') + '\n'
}
