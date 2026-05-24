import type { ValidationError } from './types.js'

const c = (code: number, text: string) => `\x1b[${code}m${text}\x1b[0m`

export function formatErrors(errors: ValidationError[]): string {
  const lines: string[] = [
    '',
    c(31, `✖ envault: ${errors.length} environment variable${errors.length > 1 ? 's' : ''} failed validation`),
    '',
  ]

  for (const err of errors) {
    lines.push(`  ${c(33, err.key.padEnd(32))}${c(90, '→')}  ${c(97, err.message)}`)
  }

  lines.push('')
  lines.push(c(36, '  Fix the above in your .env file or deployment environment configuration.'))
  lines.push('')

  return lines.join('\n')
}

export function formatWarnings(warnings: string[]): string {
  const lines: string[] = ['']
  for (const w of warnings) {
    lines.push(`  ${c(33, '⚠')}  ${c(33, w)}`)
  }
  lines.push('')
  return lines.join('\n')
}

export function maskValue(val: string): string {
  if (!val) return c(90, '(empty)')
  if (val.length <= 4) return '****'
  return val.slice(0, 2) + '*'.repeat(Math.min(val.length - 2, 20))
}
