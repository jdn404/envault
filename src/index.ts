import { loadEnvFile } from './loader.js'
import { validateSchema } from './validator.js'
import { formatErrors } from './reporter.js'
import type { FieldSpec } from './types.js'

export { str, num, bool, url, port, email, json, list } from './validators/index.js'
export type { StrOptions, NumOptions, BoolOptions, UrlOptions, PortOptions, EmailOptions, JsonOptions, ListOptions } from './types.js'

export interface EnvaultOptions {
  path?: string
  override?: boolean
}

type ResolvedSchema<T extends Record<string, FieldSpec | Record<string, FieldSpec>>> = {
  [K in keyof T]: T[K] extends FieldSpec
    ? T[K]['type'] extends 'str' ? string
    : T[K]['type'] extends 'num' ? number
    : T[K]['type'] extends 'bool' ? boolean
    : T[K]['type'] extends 'url' ? string
    : T[K]['type'] extends 'port' ? number
    : T[K]['type'] extends 'email' ? string
    : T[K]['type'] extends 'json' ? unknown
    : T[K]['type'] extends 'list' ? string[]
    : never
    : {
        [NK in keyof T[K]]: T[K][NK] extends FieldSpec
          ? T[K][NK]['type'] extends 'str' ? string
          : T[K][NK]['type'] extends 'num' ? number
          : T[K][NK]['type'] extends 'bool' ? boolean
          : T[K][NK]['type'] extends 'url' ? string
          : T[K][NK]['type'] extends 'port' ? number
          : T[K][NK]['type'] extends 'email' ? string
          : T[K][NK]['type'] extends 'json' ? unknown
          : T[K][NK]['type'] extends 'list' ? string[]
          : never
          : never
      }
}

export function envault<T extends Record<string, FieldSpec | Record<string, FieldSpec>>>(
  schema: T,
  options: EnvaultOptions = {}
): ResolvedSchema<T> {
  const fileVars = loadEnvFile(options)

  const env: Record<string, string | undefined> = {
    ...fileVars,
    ...process.env,
  }

  const { result, errors } = validateSchema(
    schema as Record<string, FieldSpec | Record<string, FieldSpec>>,
    env
  )

  if (errors.length > 0) {
    console.error(formatErrors(errors))
    process.exit(1)
  }

  return result as ResolvedSchema<T>
}
