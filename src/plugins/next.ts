import { envault as baseEnvault } from '../index.js'
import type { EnvaultOptions } from '../index.js'
import type { FieldSpec } from '../types.js'

export { str, num, bool, url, port, email, json, list } from '../validators/index.js'

export function envault<T extends Record<string, FieldSpec | Record<string, FieldSpec>>>(
  schema: T,
  options: EnvaultOptions = {}
) {
  return baseEnvault(schema, { path: options.path ?? '.env.local', ...options })
}
