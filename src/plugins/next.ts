import { envault, envaultSplit } from '../index.js'
import type { EnvaultOptions, FieldSpec, SchemaShape, ResolvedSchema } from '../types.js'

export {
  str, num, bool, url, port, email, json, list, uuid, secret, date, phone,
  semver, ip, hex, cidr, jwt, base64, slug, locale, timezone, cron, duration,
  filepath, hash, creditcard, iban, latitude, longitude, country, currency,
  mimetype, enm, presets,
  envIsDev, envIsProd, envIsTest, envIsStaging,
} from '../index.js'
export type { InferEnv, WatchEvent, DocsOptions, EnvaultOptions, ValidationError } from '../types.js'

const NEXT_ENV_FILES = [
  '.env',
  '.env.local',
  `.env.${process.env.NODE_ENV ?? 'development'}`,
  `.env.${process.env.NODE_ENV ?? 'development'}.local`,
]

export function createNextEnv<
  S extends Record<string, FieldSpec | Record<string, FieldSpec>>,
  C extends Record<string, FieldSpec | Record<string, FieldSpec>>,
>(
  splitSchema: { server: S; client: C },
  options: EnvaultOptions = {}
) {
  const { path: customPath, ...rest } = options
  return envaultSplit(splitSchema, {
    path: customPath ?? NEXT_ENV_FILES,
    clientPrefix: 'NEXT_PUBLIC_',
    ...rest,
  })
}

export function createEnv<T extends SchemaShape>(
  schema: T,
  options: EnvaultOptions = {}
): Readonly<ResolvedSchema<T>> {
  const { path: customPath, ...rest } = options
  return envault(schema, {
    path: customPath ?? NEXT_ENV_FILES,
    ...rest,
  })
}
