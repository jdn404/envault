import { envault } from '../index.js'
import type { EnvaultOptions } from '../types.js'
import type { SchemaShape, ResolvedSchema } from '../types.js'

export {
  str, num, bool, url, port, email, json, list, uuid, secret, date, phone,
  semver, ip, hex, enm, presets,
  envIsDev, envIsProd, envIsTest, envIsStaging,
} from '../index.js'
export type { InferEnv } from '../types.js'

export function createEnv<T extends SchemaShape>(
  schema: T,
  options: EnvaultOptions = {}
): Readonly<ResolvedSchema<T>> {
  return envault(schema, options)
}

export function envaultPlugin<T extends SchemaShape>(
  schema: T,
  options: EnvaultOptions = {}
) {
  return {
    name: 'vite-plugin-envault',
    config() {
      envault(schema, options)
    },
    configureServer() {
      envault(schema, options)
    },
  }
}
