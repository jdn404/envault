import type { ValidationError } from './types.js'

const c = (code: number, text: string) => `\x1b[${code}m${text}\x1b[0m`
const bold = (text: string) => `\x1b[1m${text}\x1b[0m`
const dim = (text: string) => `\x1b[2m${text}\x1b[0m`

const TYPE_LABELS: Record<string, string> = {
  str: 'string', num: 'number', bool: 'boolean', url: 'URL', port: 'port',
  email: 'email', json: 'JSON', list: 'list', uuid: 'UUID', secret: 'secret',
  date: 'date', phone: 'phone', semver: 'semver', ip: 'IP', hex: 'hex color',
  cidr: 'CIDR', jwt: 'JWT', base64: 'base64', slug: 'slug', locale: 'locale',
  timezone: 'timezone', cron: 'cron', duration: 'duration', filepath: 'filepath',
  hash: 'hash', creditcard: 'credit card', iban: 'IBAN', latitude: 'latitude',
  longitude: 'longitude', country: 'country', currency: 'currency', mimetype: 'MIME type',
}

export function formatErrors(errors: ValidationError[]): string {
  const lines: string[] = [
    '',
    c(31, bold(`✖ envault: ${errors.length} environment variable${errors.length > 1 ? 's' : ''} failed validation`)),
    '',
  ]

  for (const err of errors) {
    const keyStr = c(33, err.key.padEnd(32))
    const arrow = c(90, '→')
    const msg = c(97, err.message)
    lines.push(`  ${keyStr}${arrow}  ${msg}`)
    if (err.type) {
      lines.push(`  ${' '.repeat(34)}${dim(`expected: ${TYPE_LABELS[err.type] ?? err.type}`)}`)
    }
  }

  lines.push('')
  lines.push(c(36, '  Fix the above in your .env file or deployment environment configuration.'))
  lines.push(c(90, dim('  Run `envault doctor` to inspect all loaded env files.')))
  lines.push('')
  return lines.join('\n')
}

export function formatErrorsJson(errors: ValidationError[]): string {
  return JSON.stringify({ valid: false, errors: errors.map(e => ({ key: e.key, message: e.message, type: e.type })) }, null, 2)
}

export function formatErrorsMinimal(errors: ValidationError[]): string {
  return errors.map(e => `${e.key}: ${e.message}`).join('\n')
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
  if (!val || val.length === 0) return c(90, '(empty)')
  if (val.length <= 4) return '****'
  return val.slice(0, 2) + '*'.repeat(Math.min(val.length - 2, 20))
}

export function formatSuccess(count: number): string {
  return [
    '',
    c(32, `  ✔ envault: ${count} variable${count !== 1 ? 's' : ''} validated successfully`),
    '',
  ].join('\n')
}

export function formatValidationSummary(
  valid: number,
  invalid: number,
  warnings: number,
  duration: number
): string {
  const lines: string[] = ['']
  lines.push(c(36, '  envault validation summary'))
  lines.push('')
  lines.push(`  ${c(32, '✔')}  ${valid} valid`)
  if (invalid > 0) lines.push(`  ${c(31, '✖')}  ${invalid} invalid`)
  if (warnings > 0) lines.push(`  ${c(33, '⚠')}  ${warnings} warnings`)
  lines.push(`  ${c(90, '⏱')}  ${duration}ms`)
  lines.push('')
  return lines.join('\n')
}

export function formatKeyValue(key: string, value: string, sensitive: boolean = false): string {
  const displayVal = sensitive ? maskValue(value) : (value || c(90, '(empty)'))
  return `  ${c(33, key.padEnd(32))}${displayVal}`
}

export function formatBanner(): string {
  return [
    '',
    c(36, '  ╔══════════════════════════════════════╗'),
    c(36, '  ║         envault by jadendev          ║'),
    c(36, '  ╚══════════════════════════════════════╝'),
    '',
  ].join('\n')
}
