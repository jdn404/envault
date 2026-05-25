import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import type { SchemaShape, FieldSpec } from './types.js'

export interface SchemaDiff {
  added: DiffEntry[]
  removed: DiffEntry[]
  changed: DiffEntry[]
  unchanged: DiffEntry[]
  breaking: DiffEntry[]
}

export interface DiffEntry {
  key: string
  oldType?: string
  newType?: string
  oldRequired?: boolean
  newRequired?: boolean
  oldDefault?: unknown
  newDefault?: unknown
  reason?: string
}

export interface MigrationPlan {
  diff: SchemaDiff
  envFilePath: string
  missingRequired: string[]
  missingOptional: string[]
  staleKeys: string[]
  canMigrate: boolean
  steps: string[]
}

export interface MigrationResult {
  success: boolean
  addedKeys: string[]
  removedKeys: string[]
  warnings: string[]
  updatedContent: string
}

function flattenSchema(schema: SchemaShape): Record<string, FieldSpec> {
  const flat: Record<string, FieldSpec> = {}

  for (const [key, spec] of Object.entries(schema)) {
    if ('type' in spec) {
      flat[key] = spec as FieldSpec
    } else {
      for (const [nestedKey, nestedSpec] of Object.entries(spec)) {
        if ('type' in nestedSpec) {
          flat[`${key}_${nestedKey}`.toUpperCase()] = nestedSpec as FieldSpec
        }
      }
    }
  }

  return flat
}

function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1)
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    result[key] = val
  }
  return result
}

function isRequired(spec: FieldSpec): boolean {
  const opts = spec.options as Record<string, unknown>
  return opts.optional !== true && opts.required !== false && opts.default === undefined
}

export function diffSchemas(
  oldSchema: SchemaShape,
  newSchema: SchemaShape
): SchemaDiff {
  const oldFlat = flattenSchema(oldSchema)
  const newFlat = flattenSchema(newSchema)

  const added: DiffEntry[] = []
  const removed: DiffEntry[] = []
  const changed: DiffEntry[] = []
  const unchanged: DiffEntry[] = []
  const breaking: DiffEntry[] = []

  for (const [key, newSpec] of Object.entries(newFlat)) {
    if (!(key in oldFlat)) {
      const entry: DiffEntry = {
        key,
        newType: newSpec.type,
        newRequired: isRequired(newSpec),
        newDefault: (newSpec.options as Record<string, unknown>).default,
      }
      added.push(entry)
      if (isRequired(newSpec)) breaking.push({ ...entry, reason: 'New required variable' })
    } else {
      const oldSpec = oldFlat[key]
      const oldOpts = oldSpec.options as Record<string, unknown>
      const newOpts = newSpec.options as Record<string, unknown>

      const typeChanged = oldSpec.type !== newSpec.type
      const requiredChanged = isRequired(oldSpec) !== isRequired(newSpec)
      const defaultChanged = JSON.stringify(oldOpts.default) !== JSON.stringify(newOpts.default)

      if (typeChanged || requiredChanged || defaultChanged) {
        const entry: DiffEntry = {
          key,
          oldType: oldSpec.type,
          newType: newSpec.type,
          oldRequired: isRequired(oldSpec),
          newRequired: isRequired(newSpec),
          oldDefault: oldOpts.default,
          newDefault: newOpts.default,
        }
        changed.push(entry)

        if (typeChanged) breaking.push({ ...entry, reason: `Type changed from ${oldSpec.type} to ${newSpec.type}` })
        if (!isRequired(oldSpec) && isRequired(newSpec)) breaking.push({ ...entry, reason: 'Became required' })
      } else {
        unchanged.push({ key, newType: newSpec.type, newRequired: isRequired(newSpec) })
      }
    }
  }

  for (const key of Object.keys(oldFlat)) {
    if (!(key in newFlat)) {
      removed.push({ key, oldType: oldFlat[key].type, oldRequired: isRequired(oldFlat[key]) })
    }
  }

  return { added, removed, changed, unchanged, breaking }
}

export function planMigration(
  schema: SchemaShape,
  envFilePath: string,
  cwd: string = process.cwd()
): MigrationPlan {
  const flat = flattenSchema(schema)
  const filePath = resolve(cwd, envFilePath)
  const envVars = existsSync(filePath) ? parseEnvFile(readFileSync(filePath, 'utf-8')) : {}

  const missingRequired: string[] = []
  const missingOptional: string[] = []
  const staleKeys: string[] = []
  const steps: string[] = []

  for (const [key, spec] of Object.entries(flat)) {
    if (!(key in envVars)) {
      if (isRequired(spec)) missingRequired.push(key)
      else missingOptional.push(key)
    }
  }

  for (const key of Object.keys(envVars)) {
    if (!(key in flat)) staleKeys.push(key)
  }

  if (missingRequired.length > 0) {
    steps.push(`Add ${missingRequired.length} required variable${missingRequired.length > 1 ? 's' : ''}: ${missingRequired.join(', ')}`)
  }
  if (missingOptional.length > 0) {
    steps.push(`Optionally add ${missingOptional.length} optional variable${missingOptional.length > 1 ? 's' : ''}: ${missingOptional.join(', ')}`)
  }
  if (staleKeys.length > 0) {
    steps.push(`Consider removing ${staleKeys.length} stale variable${staleKeys.length > 1 ? 's' : ''}: ${staleKeys.join(', ')}`)
  }

  if (steps.length === 0) steps.push('No migration needed — env file is up to date')

  return {
    diff: diffSchemas({}, schema),
    envFilePath,
    missingRequired,
    missingOptional,
    staleKeys,
    canMigrate: missingRequired.length === 0,
    steps,
  }
}

export function applyMigration(
  schema: SchemaShape,
  envFilePath: string,
  cwd: string = process.cwd()
): MigrationResult {
  const flat = flattenSchema(schema)
  const filePath = resolve(cwd, envFilePath)
  const content = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : ''
  const envVars = parseEnvFile(content)

  const addedKeys: string[] = []
  const removedKeys: string[] = []
  const warnings: string[] = []

  const lines = content ? content.split('\n') : []

  for (const [key, spec] of Object.entries(flat)) {
    if (!(key in envVars)) {
      const opts = spec.options as Record<string, unknown>
      const defaultVal = opts.default !== undefined ? String(opts.default) : ''
      const example = opts.example as string | undefined
      const desc = opts.description as string | undefined

      if (desc) lines.push(`# ${desc}`)
      lines.push(`${key}=${example ?? defaultVal}`)
      addedKeys.push(key)
    }
  }

  for (const key of Object.keys(envVars)) {
    if (!(key in flat)) {
      warnings.push(`${key} is in .env but not in schema`)
    }
  }

  const updatedContent = lines.join('\n') + '\n'
  writeFileSync(filePath, updatedContent, 'utf-8')

  return {
    success: true,
    addedKeys,
    removedKeys,
    warnings,
    updatedContent,
  }
}

export function formatDiff(diff: SchemaDiff, color: boolean = true): string {
  const c = color ? (code: number, text: string) => `\x1b[${code}m${text}\x1b[0m` : (_: number, text: string) => text
  const lines: string[] = ['']

  if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
    lines.push(c(32, '  ✔ Schemas are identical'))
    lines.push('')
    return lines.join('\n')
  }

  if (diff.breaking.length > 0) {
    lines.push(c(31, `  ⚠ ${diff.breaking.length} breaking change${diff.breaking.length > 1 ? 's' : ''}`))
    for (const entry of diff.breaking) {
      lines.push(`    ${c(31, '•')} ${c(33, entry.key)} — ${entry.reason}`)
    }
    lines.push('')
  }

  if (diff.added.length > 0) {
    lines.push(c(32, `  + ${diff.added.length} added`))
    for (const entry of diff.added) {
      const req = entry.newRequired ? c(31, ' (required)') : c(90, ' (optional)')
      lines.push(`    ${c(32, '+')} ${c(33, entry.key)} ${c(90, entry.newType ?? '')}${req}`)
    }
    lines.push('')
  }

  if (diff.removed.length > 0) {
    lines.push(c(31, `  - ${diff.removed.length} removed`))
    for (const entry of diff.removed) {
      lines.push(`    ${c(31, '-')} ${c(33, entry.key)} ${c(90, entry.oldType ?? '')}`)
    }
    lines.push('')
  }

  if (diff.changed.length > 0) {
    lines.push(c(33, `  ~ ${diff.changed.length} changed`))
    for (const entry of diff.changed) {
      const typeChange = entry.oldType !== entry.newType ? ` type: ${entry.oldType} → ${entry.newType}` : ''
      const reqChange = entry.oldRequired !== entry.newRequired ? ` required: ${entry.oldRequired} → ${entry.newRequired}` : ''
      lines.push(`    ${c(33, '~')} ${c(33, entry.key)}${c(90, typeChange + reqChange)}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
