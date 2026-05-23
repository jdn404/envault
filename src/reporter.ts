import type { ValidationError } from './types.js'

export function formatErrors(errors: ValidationError[]): string {
  const lines: string[] = [
    '',
    `\x1b[31m❌ envault: ${errors.length} environment variable${errors.length > 1 ? 's' : ''} failed validation\x1b[0m`,
    '',
  ]

  for (const err of errors) {
    lines.push(`  \x1b[33m${err.key.padEnd(20)}\x1b[0m→  ${err.message}`)
  }

  lines.push('')
  lines.push('\x1b[36m💡 Check your .env file or environment configuration.\x1b[0m')
  lines.push('')

  return lines.join('\n')
}
