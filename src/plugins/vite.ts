import { envault } from '../index.js'
import type { EnvaultOptions, SchemaShape, ResolvedSchema } from '../types.js'

export {
  str, num, bool, url, port, email, json, list, uuid, secret, date, phone,
  semver, ip, hex, cidr, jwt, base64, slug, locale, timezone, cron, duration,
  filepath, hash, creditcard, iban, latitude, longitude, country, currency,
  mimetype, enm, presets,
  envIsDev, envIsProd, envIsTest, envIsStaging,
} from '../index.js'
export type { InferEnv, WatchEvent, DocsOptions, EnvaultOptions, ValidationError } from '../types.js'

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
    config() { envault(schema, options) },
    configureServer() { envault(schema, options) },
  }
}
