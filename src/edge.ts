import type { SchemaShape, ResolvedSchema, EnvaultOptions, ValidationError } from './types.js'
import { validateSchema } from './validator.js'
import { formatErrors } from './reporter.js'

export {
  str, num, bool, url, port, email, json, list, uuid, secret, date, phone,
  semver, ip, hex, enm,
} from './validators/index.js'
export type { InferEnv, EnvRecord, CrossFieldRule, ConditionalRule } from './types.js'

export interface EdgeEnvOptions {
  onError?: (errors: ValidationError[]) => void
  throws?: boolean
  source?: Record<string, string | undefined>
}

function freezeDeep<T extends object>(obj: T): Readonly<T> {
  for (const val of Object.values(obj)) {
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      freezeDeep(val as object)
    }
  }
  return Object.freeze(obj)
}

function isDev(source: Record<string, string | undefined>): boolean {
  const e = source['NODE_ENV'] ?? source['NEXT_PUBLIC_NODE_ENV'] ?? source['CF_PAGES'] ? 'development' : undefined
  return !e || e === 'development' || e === 'dev' || e === 'test'
}

export function envaultEdge<T extends SchemaShape>(
  schema: T,
  source: Record<string, string | undefined>,
  options: EdgeEnvOptions = {}
): Readonly<ResolvedSchema<T>> {
  const env = options.source ?? source

  const dev = isDev(env)
  const { result, errors, warnings } = validateSchema(schema as SchemaShape, env, dev)

  if (warnings.length > 0 && typeof console !== 'undefined') {
    for (const w of warnings) console.warn(`[envault] ${w}`)
  }

  if (errors.length > 0) {
    if (options.onError) {
      options.onError(errors)
    } else if (options.throws) {
      throw new Error(formatErrors(errors))
    } else {
      throw new Error(formatErrors(errors))
    }
  }

  return freezeDeep(result as ResolvedSchema<T>)
}

export function envaultCloudflare<T extends SchemaShape>(
  schema: T,
  bindings: Record<string, string | undefined>,
  options: EdgeEnvOptions = {}
): Readonly<ResolvedSchema<T>> {
  return envaultEdge(schema, bindings, options)
}

export function envaultDeno<T extends SchemaShape>(
  schema: T,
  options: EdgeEnvOptions = {}
): Readonly<ResolvedSchema<T>> {
  let source: Record<string, string | undefined> = {}

  if (typeof Deno !== 'undefined') {
    try {
      const denoEnv = (Deno as { env: { toObject: () => Record<string, string> } }).env.toObject()
      source = denoEnv
    } catch {
      source = {}
    }
  }

  return envaultEdge(schema, source, options)
}

export function envaultBun<T extends SchemaShape>(
  schema: T,
  options: EdgeEnvOptions = {}
): Readonly<ResolvedSchema<T>> {
  let source: Record<string, string | undefined> = {}

  if (typeof process !== 'undefined' && process.env) {
    source = process.env as Record<string, string | undefined>
  }

  if (typeof Bun !== 'undefined') {
    try {
      const bunEnv = (Bun as { env: Record<string, string | undefined> }).env
      source = { ...source, ...bunEnv }
    } catch {
      source = {}
    }
  }

  return envaultEdge(schema, source, options)
}

export function fromImportMetaEnv<T extends SchemaShape>(
  schema: T,
  importMetaEnv: Record<string, string | undefined>,
  options: EdgeEnvOptions = {}
): Readonly<ResolvedSchema<T>> {
  return envaultEdge(schema, importMetaEnv, options)
}

declare const Deno: unknown
declare const Bun: unknown
