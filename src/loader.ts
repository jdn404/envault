import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

export interface LoaderOptions {
  path?: string
  override?: boolean
}

export function loadEnvFile(options: LoaderOptions = {}): Record<string, string> {
  const envPath = resolve(process.cwd(), options.path ?? '.env')

  if (!existsSync(envPath)) return {}

  const content = readFileSync(envPath, 'utf-8')
  const result: Record<string, string> = {}

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue

    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '')

    if (key && (options.override !== false || !(key in process.env))) {
      result[key] = value
    }
  }

  return result
}
