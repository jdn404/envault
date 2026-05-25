import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'
import type { SchemaShape, FieldSpec, ResolvedSchema, EnvaultOptions } from './types.js'

export interface MonorepoPackage {
  name: string
  path: string
  schema?: SchemaShape
}

export interface MonorepoSchema {
  shared: SchemaShape
  packages: Record<string, SchemaShape>
}

export interface MonorepoEnv<
  S extends SchemaShape,
  P extends Record<string, SchemaShape>
> {
  shared: Readonly<ResolvedSchema<S>>
  packages: { [K in keyof P]: Readonly<ResolvedSchema<P[K]>> }
}

function readPackageJson(dir: string): { name?: string; workspaces?: string[] } {
  const pkgPath = join(dir, 'package.json')
  if (!existsSync(pkgPath)) return {}
  try { return JSON.parse(readFileSync(pkgPath, 'utf-8')) } catch { return {} }
}

function globWorkspaces(root: string, patterns: string[]): string[] {
  const packages: string[] = []

  for (const pattern of patterns) {
    const parts = pattern.split('/')
    const baseDir = parts[0].replace(/\*$/, '')
    const basePath = join(root, baseDir)

    if (!existsSync(basePath)) continue

    try {
      const entries = readdirSync(basePath)
      for (const entry of entries) {
        const fullPath = join(basePath, entry)
        try {
          if (statSync(fullPath).isDirectory() && existsSync(join(fullPath, 'package.json'))) {
            packages.push(fullPath)
          }
        } catch {}
      }
    } catch {}
  }

  return packages
}

export function detectWorkspacePackages(root: string = process.cwd()): MonorepoPackage[] {
  const rootPkg = readPackageJson(root)
  const packages: MonorepoPackage[] = []

  const workspacePatterns: string[] = []

  if (Array.isArray(rootPkg.workspaces)) {
    workspacePatterns.push(...rootPkg.workspaces)
  } else {
    const pnpmWorkspacePath = join(root, 'pnpm-workspace.yaml')
    if (existsSync(pnpmWorkspacePath)) {
      const content = readFileSync(pnpmWorkspacePath, 'utf-8')
      const matches = content.match(/^\s*-\s*['"]?(.+?)['"]?\s*$/gm) ?? []
      for (const match of matches) {
        const pattern = match.trim().replace(/^-\s*/, '').replace(/['"]/g, '')
        workspacePatterns.push(pattern)
      }
    }
  }

  if (workspacePatterns.length === 0) {
    for (const dir of ['packages', 'apps', 'libs', 'services']) {
      const dirPath = join(root, dir)
      if (existsSync(dirPath)) workspacePatterns.push(`${dir}/*`)
    }
  }

  const packageDirs = globWorkspaces(root, workspacePatterns)

  for (const pkgDir of packageDirs) {
    const pkg = readPackageJson(pkgDir)
    if (pkg.name) {
      packages.push({ name: pkg.name, path: pkgDir })
    }
  }

  return packages
}

export function createSharedSchema<S extends SchemaShape>(shared: S): S {
  return shared
}

export function extendSchema<
  B extends SchemaShape,
  E extends SchemaShape
>(base: B, extension: E): B & E {
  return { ...base, ...extension }
}

export function pickSchema<
  T extends SchemaShape,
  K extends keyof T
>(schema: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>
  for (const key of keys) {
    if (key in schema) result[key] = schema[key] as Pick<T, K>[K]
  }
  return result
}

export function omitSchema<
  T extends SchemaShape,
  K extends keyof T
>(schema: T, keys: K[]): Omit<T, K> {
  const result = { ...schema } as SchemaShape
  for (const key of keys) delete result[key as string]
  return result as Omit<T, K>
}

export function mergeSchemas<
  A extends SchemaShape,
  B extends SchemaShape
>(...schemas: [A, B]): A & B
export function mergeSchemas<
  A extends SchemaShape,
  B extends SchemaShape,
  C extends SchemaShape
>(...schemas: [A, B, C]): A & B & C
export function mergeSchemas(...schemas: SchemaShape[]): SchemaShape {
  return Object.assign({}, ...schemas)
}

export function validateMonorepoEnvs<
  S extends SchemaShape,
  P extends Record<string, SchemaShape>
>(
  monorepoSchema: MonorepoSchema & { shared: S; packages: P },
  options: EnvaultOptions = {}
): { valid: boolean; errors: Record<string, string[]>; warnings: string[] } {
  const errors: Record<string, string[]> = {}
  const warnings: string[] = []

  const allErrors: string[] = []
  for (const key of Object.keys(monorepoSchema.shared)) {
    const spec = monorepoSchema.shared[key]
    if ('type' in spec) {
      const opts = spec.options as Record<string, unknown>
      const val = process.env[key]
      if (!val && opts.optional !== true && opts.required !== false && opts.default === undefined) {
        allErrors.push(`${key}: missing required variable`)
      }
    }
  }

  if (allErrors.length > 0) errors['shared'] = allErrors

  for (const [pkgName, pkgSchema] of Object.entries(monorepoSchema.packages)) {
    const pkgErrors: string[] = []
    for (const key of Object.keys(pkgSchema)) {
      const spec = pkgSchema[key]
      if ('type' in spec) {
        const opts = spec.options as Record<string, unknown>
        const val = process.env[key]
        if (!val && opts.optional !== true && opts.required !== false && opts.default === undefined) {
          pkgErrors.push(`${key}: missing required variable`)
        }
      }
    }
    if (pkgErrors.length > 0) errors[pkgName] = pkgErrors
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    warnings,
  }
}

export function generateMonorepoEnvExample(
  monorepoSchema: MonorepoSchema,
  cwd: string = process.cwd()
): string {
  const lines: string[] = [
    '# Monorepo environment variables — generated by envault',
    `# ${new Date().toISOString()}`,
    '',
    '# ── SHARED (required by all packages)',
  ]

  const sharedFlat = flattenSchemaToKeys(monorepoSchema.shared)
  for (const key of sharedFlat) lines.push(`${key}=`)
  lines.push('')

  for (const [pkgName, pkgSchema] of Object.entries(monorepoSchema.packages)) {
    lines.push(`# ── ${pkgName.toUpperCase()}`)
    const pkgFlat = flattenSchemaToKeys(pkgSchema)
    for (const key of pkgFlat) lines.push(`${key}=`)
    lines.push('')
  }

  return lines.join('\n')
}

function flattenSchemaToKeys(schema: SchemaShape): string[] {
  const keys: string[] = []
  for (const [key, spec] of Object.entries(schema)) {
    if ('type' in spec) {
      keys.push(key)
    } else {
      for (const nestedKey of Object.keys(spec)) {
        keys.push(`${key}_${nestedKey}`.toUpperCase())
      }
    }
  }
  return keys
}
