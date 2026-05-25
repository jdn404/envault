import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import type { SchemaShape, FieldSpec, DocsOptions } from './types.js'

interface DocEntry {
  key: string
  type: string
  required: boolean
  optional: boolean
  default?: unknown
  description?: string
  example?: string
  choices?: readonly string[]
  group?: string
  devOnly?: boolean
  deprecated?: boolean | string
  sensitive?: boolean
  nested?: boolean
  parentKey?: string
}

function extractEntries(schema: SchemaShape): DocEntry[] {
  const entries: DocEntry[] = []

  for (const [key, spec] of Object.entries(schema)) {
    if ('type' in spec) {
      const fieldSpec = spec as FieldSpec
      const opts = fieldSpec.options as Record<string, unknown>
      entries.push({
        key,
        type: fieldSpec.type,
        required: opts.optional !== true && opts.required !== false && opts.default === undefined,
        optional: opts.optional === true || opts.required === false,
        default: opts.default,
        description: opts.description as string | undefined,
        example: opts.example as string | undefined,
        choices: opts.choices as readonly string[] | undefined,
        group: opts.group as string | undefined,
        devOnly: opts.devOnly as boolean | undefined,
        deprecated: opts.deprecated as boolean | string | undefined,
        sensitive: opts.sensitive as boolean | undefined,
      })
    } else {
      for (const [nestedKey, nestedSpec] of Object.entries(spec)) {
        if (!('type' in nestedSpec)) continue
        const fieldSpec = nestedSpec as FieldSpec
        const opts = fieldSpec.options as Record<string, unknown>
        const envKey = `${key}_${nestedKey}`.toUpperCase()
        entries.push({
          key: envKey,
          type: fieldSpec.type,
          required: opts.optional !== true && opts.required !== false && opts.default === undefined,
          optional: opts.optional === true || opts.required === false,
          default: opts.default,
          description: opts.description as string | undefined,
          example: opts.example as string | undefined,
          choices: opts.choices as readonly string[] | undefined,
          group: opts.group as string | undefined ?? key.toLowerCase(),
          devOnly: opts.devOnly as boolean | undefined,
          deprecated: opts.deprecated as boolean | string | undefined,
          sensitive: opts.sensitive as boolean | undefined,
          nested: true,
          parentKey: key,
        })
      }
    }
  }

  return entries
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    str: 'string', num: 'number', bool: 'boolean', url: 'URL',
    port: 'port', email: 'email', json: 'JSON', list: 'string[]',
    uuid: 'UUID', secret: 'secret', date: 'Date', phone: 'phone',
    semver: 'semver', ip: 'IP address', hex: 'hex color', cidr: 'CIDR',
    jwt: 'JWT', base64: 'base64', slug: 'slug', locale: 'locale',
    timezone: 'timezone', cron: 'cron', duration: 'duration',
    filepath: 'filepath', hash: 'hash', creditcard: 'credit card',
    iban: 'IBAN', latitude: 'latitude', longitude: 'longitude',
    country: 'country', currency: 'currency', mimetype: 'MIME type',
  }
  return labels[type] ?? type
}

export function generateMarkdownDocs(schema: SchemaShape, options: DocsOptions = {}): string {
  const {
    title = 'Environment Variables',
    description,
    includeDefaults = true,
    includeExamples = true,
    groupBy = 'prefix',
  } = options

  const entries = extractEntries(schema)
  const lines: string[] = []

  lines.push(`# ${title}`)
  lines.push('')

  if (description) {
    lines.push(description)
    lines.push('')
  }

  const required = entries.filter(e => e.required && !e.devOnly)
  const optional = entries.filter(e => !e.required)
  const devOnly = entries.filter(e => e.devOnly)
  const deprecated = entries.filter(e => e.deprecated)

  lines.push(`## Summary`)
  lines.push('')
  lines.push(`| | Count |`)
  lines.push(`|:--|:--|`)
  lines.push(`| Total variables | ${entries.length} |`)
  lines.push(`| Required | ${required.length} |`)
  lines.push(`| Optional | ${optional.length} |`)
  lines.push(`| Dev only | ${devOnly.length} |`)
  if (deprecated.length > 0) lines.push(`| Deprecated | ${deprecated.length} |`)
  lines.push('')

  function renderTable(tableEntries: DocEntry[]): void {
    const cols = ['Variable', 'Type', 'Required', ...(includeDefaults ? ['Default'] : []), ...(includeExamples ? ['Example'] : []), 'Description']
    lines.push(`| ${cols.join(' | ')} |`)
    lines.push(`|${cols.map(() => ':--').join('|')}|`)

    for (const entry of tableEntries) {
      const isRequired = entry.required ? '✅ Yes' : '⬜ No'
      const defaultVal = entry.default !== undefined ? `\`${entry.default}\`` : entry.optional ? '*undefined*' : '-'
      const exampleVal = entry.example ? `\`${entry.example}\`` : entry.choices ? `\`${entry.choices[0]}\`` : '-'
      const desc = [
        entry.description ?? '',
        entry.choices ? `One of: ${entry.choices.map(c => `\`${c}\``).join(', ')}` : '',
        entry.devOnly ? '🛠 Dev only' : '',
        entry.deprecated ? `⚠️ Deprecated${typeof entry.deprecated === 'string' ? `: ${entry.deprecated}` : ''}` : '',
        entry.sensitive ? '🔒 Sensitive' : '',
      ].filter(Boolean).join(' · ')

      const cells = [
        `\`${entry.key}\``,
        `\`${typeLabel(entry.type)}\``,
        isRequired,
        ...(includeDefaults ? [defaultVal] : []),
        ...(includeExamples ? [exampleVal] : []),
        desc || '-',
      ]
      lines.push(`| ${cells.join(' | ')} |`)
    }
    lines.push('')
  }

  if (groupBy === 'prefix' || groupBy === 'group') {
    const groups: Map<string, DocEntry[]> = new Map()
    const ungrouped: DocEntry[] = []

    for (const entry of entries) {
      const groupKey = entry.group ?? (groupBy === 'prefix' ? entry.key.split('_')[0] : undefined)
      if (groupKey && entries.filter(e => (e.group ?? e.key.split('_')[0]) === groupKey).length > 1) {
        if (!groups.has(groupKey)) groups.set(groupKey, [])
        groups.get(groupKey)!.push(entry)
      } else {
        ungrouped.push(entry)
      }
    }

    if (ungrouped.length > 0) {
      lines.push('## General')
      lines.push('')
      renderTable(ungrouped)
    }

    for (const [group, groupEntries] of groups) {
      lines.push(`## ${group.charAt(0).toUpperCase() + group.slice(1).toLowerCase()}`)
      lines.push('')
      renderTable(groupEntries)
    }
  } else {
    lines.push('## Variables')
    lines.push('')
    renderTable(entries)
  }

  if (deprecated.length > 0) {
    lines.push('## Deprecated')
    lines.push('')
    lines.push('These variables are deprecated and will be removed in a future version:')
    lines.push('')
    for (const entry of deprecated) {
      const msg = typeof entry.deprecated === 'string' ? entry.deprecated : 'No replacement specified'
      lines.push(`- \`${entry.key}\` — ${msg}`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('*Generated by [envault](https://www.npmjs.com/package/@jadendev/envault)*')
  lines.push('')

  return lines.join('\n')
}

export function generateHtmlDocs(schema: SchemaShape, options: DocsOptions = {}): string {
  const { title = 'Environment Variables', description } = options
  const entries = extractEntries(schema)
  const required = entries.filter(e => e.required && !e.devOnly).length
  const optional = entries.filter(e => !e.required).length

  const rows = entries.map(entry => {
    const badgeColor = entry.required && !entry.devOnly ? '#ef4444' : entry.devOnly ? '#f59e0b' : '#22c55e'
    const badgeText = entry.required && !entry.devOnly ? 'required' : entry.devOnly ? 'dev only' : 'optional'
    const deprecatedBadge = entry.deprecated ? `<span style="background:#6b7280;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin-left:4px">deprecated</span>` : ''
    const sensitiveBadge = entry.sensitive ? `<span style="background:#7c3aed;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin-left:4px">sensitive</span>` : ''
    const desc = entry.description ?? (entry.choices ? `One of: ${entry.choices.join(', ')}` : '')

    return `
    <tr>
      <td><code style="background:#1e293b;color:#7dd3fc;padding:3px 8px;border-radius:4px;font-size:13px">${entry.key}</code>${deprecatedBadge}${sensitiveBadge}</td>
      <td><code style="color:#a78bfa;font-size:12px">${typeLabel(entry.type)}</code></td>
      <td><span style="background:${badgeColor};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${badgeText}</span></td>
      <td style="color:#94a3b8;font-size:13px">${entry.default !== undefined ? `<code style="background:#1e293b;color:#86efac;padding:2px 6px;border-radius:3px;font-size:12px">${entry.default}</code>` : '<span style="color:#475569">—</span>'}</td>
      <td style="color:#94a3b8;font-size:13px">${desc || '<span style="color:#475569">—</span>'}</td>
    </tr>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; padding: 40px 24px; }
    .container { max-width: 1100px; margin: 0 auto; }
    header { margin-bottom: 40px; border-bottom: 1px solid #1e293b; padding-bottom: 32px; }
    h1 { font-size: 32px; font-weight: 700; color: #f8fafc; margin-bottom: 8px; }
    .subtitle { color: #64748b; font-size: 16px; margin-bottom: 24px; }
    .stats { display: flex; gap: 16px; flex-wrap: wrap; }
    .stat { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px 24px; }
    .stat-value { font-size: 28px; font-weight: 700; color: #38bdf8; }
    .stat-label { font-size: 13px; color: #64748b; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; background: #0f172a; border-radius: 12px; overflow: hidden; border: 1px solid #1e293b; }
    thead { background: #1e293b; }
    th { padding: 14px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #334155; }
    td { padding: 14px 16px; border-bottom: 1px solid #1e293b; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #0d1f36; }
    footer { margin-top: 40px; text-align: center; color: #334155; font-size: 13px; }
    footer a { color: #38bdf8; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${title}</h1>
      ${description ? `<p class="subtitle">${description}</p>` : ''}
      <div class="stats">
        <div class="stat"><div class="stat-value">${entries.length}</div><div class="stat-label">Total Variables</div></div>
        <div class="stat"><div class="stat-value">${required}</div><div class="stat-label">Required</div></div>
        <div class="stat"><div class="stat-value">${optional}</div><div class="stat-label">Optional</div></div>
      </div>
    </header>
    <table>
      <thead>
        <tr>
          <th>Variable</th>
          <th>Type</th>
          <th>Status</th>
          <th>Default</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <footer><p>Generated by <a href="https://www.npmjs.com/package/@jadendev/envault">envault</a></p></footer>
  </div>
</body>
</html>`
}

export function generateJsonDocs(schema: SchemaShape): Record<string, unknown>[] {
  return extractEntries(schema).map(entry => ({
    key: entry.key,
    type: typeLabel(entry.type),
    required: entry.required,
    optional: entry.optional,
    default: entry.default,
    description: entry.description,
    example: entry.example,
    choices: entry.choices,
    devOnly: entry.devOnly ?? false,
    deprecated: entry.deprecated ?? false,
    sensitive: entry.sensitive ?? false,
    group: entry.group,
  }))
}

export function generateEnvExample(schema: SchemaShape): string {
  const entries = extractEntries(schema)
  const lines: string[] = [
    '# Generated by envault — https://www.npmjs.com/package/@jadendev/envault',
    `# Updated: ${new Date().toISOString()}`,
    '',
  ]

  const groups: Map<string, DocEntry[]> = new Map()
  const ungrouped: DocEntry[] = []

  for (const entry of entries) {
    const prefix = entry.key.split('_')[0]
    const hasGroup = entries.filter(e => e.key.startsWith(prefix + '_')).length > 1
    if (hasGroup && prefix !== entry.key) {
      if (!groups.has(prefix)) groups.set(prefix, [])
      groups.get(prefix)!.push(entry)
    } else {
      ungrouped.push(entry)
    }
  }

  for (const entry of ungrouped) {
    if (entry.description) lines.push(`# ${entry.description}`)
    const val = entry.example ?? entry.default ?? (entry.choices ? entry.choices[0] : '') ?? ''
    const suffix = entry.sensitive ? '  # ← keep secret' : ''
    lines.push(`${entry.key}=${val}${suffix}`)
  }

  if (ungrouped.length > 0 && groups.size > 0) lines.push('')

  let isFirst = true
  for (const [group, groupEntries] of groups) {
    if (!isFirst) lines.push('')
    isFirst = false
    lines.push(`# ${group.toUpperCase()}`)
    for (const entry of groupEntries) {
      if (entry.description) lines.push(`# ${entry.description}`)
      const val = entry.example ?? entry.default ?? (entry.choices ? entry.choices[0] : '') ?? ''
      const suffix = entry.sensitive ? '  # ← keep secret' : ''
      lines.push(`${entry.key}=${val}${suffix}`)
    }
  }

  lines.push('')
  return lines.join('\n')
}

export function writeDocs(schema: SchemaShape, options: DocsOptions = {}): string {
  const { format = 'markdown', output } = options
  let content: string

  if (format === 'html') {
    content = generateHtmlDocs(schema, options)
  } else if (format === 'json') {
    content = JSON.stringify(generateJsonDocs(schema), null, 2)
  } else {
    content = generateMarkdownDocs(schema, options)
  }

  if (output) {
    const outputPath = resolve(process.cwd(), output)
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, content, 'utf-8')
  }

  return content
}
