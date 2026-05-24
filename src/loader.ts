import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

interface LoadOptions {
  path?: string | string[]
  override?: boolean
  environment?: string
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
      while (!inner.endsWith('"') && i < lines.length) {
        inner += '\n' + lines[i]
        i++
      }
      raw = inner.endsWith('"') ? inner.slice(0, -1) : inner
      raw = raw.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    } else if (raw.startsWith("'")) {
      let inner = raw.slice(1)
      while (!inner.endsWith("'") && i < lines.length) {
        inner += '\n' + lines[i]
        i++
      }
      raw = inner.endsWith("'") ? inner.slice(0, -1) : inner
    } else if (raw.startsWith('`')) {
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

    result[key] = raw
  }

  return result
}

function readEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {}
  try {
    return parseEnvContent(readFileSync(filePath, 'utf-8'))
  } catch {
    return {}
  }
}

export function loadEnvFiles(options: LoadOptions): Record<string, string> {
  const cwd = process.cwd()
  const env = options.environment ?? process.env.NODE_ENV ?? 'development'

  let filePaths: string[]

  if (options.path) {
    filePaths = (Array.isArray(options.path) ? options.path : [options.path]).map(p =>
      resolve(cwd, p)
    )
  } else {
    const candidates = [
      '.env',
      `.env.${env}`,
      '.env.local',
      `.env.${env}.local`,
    ]
    filePaths = candidates.map(f => resolve(cwd, f))
  }

  let merged: Record<string, string> = {}

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
