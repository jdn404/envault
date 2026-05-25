import { loadEnvFiles } from './loader.js'
import { validateSchema, collectSchemaEnvKeys } from './validator.js'
import { formatErrors, formatErrorsJson, formatErrorsMinimal, formatWarnings } from './reporter.js'
import type {
  FieldSpec, SchemaShape, ResolvedSchema, EnvaultOptions, EnvRecord,
  ValidationError, ConditionalRule, CrossFieldRule,
} from './types.js'

export {
  str, num, bool, url, port, email, json, list, uuid, secret, date, phone,
  semver, ip, hex, cidr, jwt, base64, slug, locale, timezone, cron, duration,
  filepath, hash, creditcard, iban, latitude, longitude, country, currency,
  mimetype, enm,
} from './validators/index.js'
export { presets } from './presets.js'
export type {
  StrOptions, NumOptions, BoolOptions, UrlOptions, PortOptions, EmailOptions,
  JsonOptions, ListOptions, UuidOptions, SecretOptions, DateOptions, PhoneOptions,
  SemverOptions, IpOptions, HexOptions, CidrOptions, JwtOptions, Base64Options,
  SlugOptions, LocaleOptions, TimezoneOptions, CronOptions, DurationOptions,
  FilepathOptions, HashOptions, CreditCardOptions, IbanOptions, LatitudeOptions,
  LongitudeOptions, CountryOptions, CurrencyOptions, MimeTypeOptions,
  EnvaultOptions, ValidationError, ConditionalRule, CrossFieldRule, EnvRecord,
  InferEnv, WatchEvent, DocsOptions,
} from './types.js'

const SYSTEM_ENV_KEYS = new Set([
  'PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'LANG', 'LC_ALL', 'LC_CTYPE',
  'TMPDIR', 'TEMP', 'TMP', 'PWD', 'OLDPWD', 'LOGNAME', 'HOSTNAME',
  'SHLVL', 'EDITOR', 'PAGER', 'COLORTERM', 'TERM_PROGRAM', 'SSH_AUTH_SOCK',
  'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS', 'DISPLAY', 'WAYLAND_DISPLAY',
  'COMPUTERNAME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'SYSTEMROOT',
  'PROCESSOR_ARCHITECTURE', 'NUMBER_OF_PROCESSORS', 'OS', 'COMSPEC',
  'PATHEXT', 'WINDIR', 'PROGRAMFILES', 'ALLUSERSPROFILE',
  'WT_SESSION', 'WT_PROFILE_ID', 'WSLENV', 'WSL_DISTRO_NAME',
])

function isDevelopment(): boolean {
  const e = process.env.NODE_ENV
  return !e || e === 'development' || e === 'dev' || e === 'test'
}

function isProduction(): boolean { return process.env.NODE_ENV === 'production' }

export function envIsDev(): boolean     { return isDevelopment() }
export function envIsProd(): boolean    { return isProduction() }
export function envIsTest(): boolean    { return process.env.NODE_ENV === 'test' }
export function envIsStaging(): boolean { return process.env.NODE_ENV === 'staging' }

function applyConditionalRules(
  rules: ConditionalRule[],
  result: EnvRecord,
  env: Record<string, string | undefined>
): ValidationError[] {
  const errors: ValidationError[] = []
  for (const rule of rules) {
    if (!rule.when(result)) continue
    for (const key of rule.require) {
      const val = env[key]
      if (val === undefined || val === '') {
        errors.push({ key, message: rule.message ?? 'required when condition is met but is missing' })
      }
    }
  }
  return errors
}

function applyCrossFieldRules(
  rules: CrossFieldRule[],
  result: EnvRecord
): ValidationError[] {
  const errors: ValidationError[] = []
  for (const rule of rules) {
    const values: EnvRecord = {}
    for (const field of rule.fields) values[field] = result[field]
    const msg = rule.validate(values)
    if (msg !== null) errors.push({ key: rule.fields.join(', '), message: msg })
  }
  return errors
}

function handleErrors(errors: ValidationError[], options: EnvaultOptions): void {
  if (options.onError) { options.onError(errors); return }
  const format = options.errorFormat ?? 'pretty'
  const msg = format === 'json' ? formatErrorsJson(errors)
    : format === 'minimal' ? formatErrorsMinimal(errors)
    : formatErrors(errors)
  if (options.throws) throw new Error(msg)
  process.stderr.write(msg + '\n')
  process.exit(1)
}

function freezeDeep<T extends object>(obj: T): Readonly<T> {
  for (const val of Object.values(obj)) {
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) freezeDeep(val as object)
  }
  return Object.freeze(obj)
}

export function envault<T extends SchemaShape>(
  schema: T,
  options: EnvaultOptions = {}
): Readonly<ResolvedSchema<T>> {
  const fileVars = loadEnvFiles({
    path: options.path,
    override: options.override,
    environment: options.environment,
  })

  const env: Record<string, string | undefined> = { ...fileVars }

  for (const [k, v] of Object.entries(process.env) as [string, string | undefined][]) {
    if (v !== undefined) env[k] = v
  }

  const dev = isDevelopment()

  if (options.strict) {
    const schemaEnvKeys = collectSchemaEnvKeys(schema)
    const strictWarnings: string[] = []
    for (const key of Object.keys(env)) {
      if (
        !schemaEnvKeys.has(key) && !SYSTEM_ENV_KEYS.has(key) &&
        !key.startsWith('npm_') && !key.startsWith('VITE_') &&
        !key.startsWith('NEXT_') && !key.startsWith('REACT_APP_') &&
        key !== 'NODE_ENV' && key !== 'CI' && key !== 'DEBUG'
      ) {
        strictWarnings.push(`strict: "${key}" is set but not declared in schema`)
      }
    }
    if (strictWarnings.length > 0) {
      if (options.onWarn) options.onWarn(strictWarnings)
      else process.stderr.write(formatWarnings(strictWarnings))
    }
  }

  const { result, errors, warnings } = validateSchema(schema, env, dev)

  if (warnings.length > 0) {
    if (options.onWarn) options.onWarn(warnings)
    else process.stderr.write(formatWarnings(warnings))
  }

  const allErrors = [...errors]
  if (options.rules?.length) allErrors.push(...applyConditionalRules(options.rules, result, env))
  if (options.crossRules?.length) allErrors.push(...applyCrossFieldRules(options.crossRules, result))

  if (allErrors.length > 0) handleErrors(allErrors, options)

  return freezeDeep(result as ResolvedSchema<T>)
}

export function envaultSplit<
  S extends Record<string, FieldSpec | Record<string, FieldSpec>>,
  C extends Record<string, FieldSpec | Record<string, FieldSpec>>,
>(
  splitSchema: { server: S; client: C },
  options: EnvaultOptions & { clientPrefix?: string } = {}
): Readonly<ResolvedSchema<S & C>> {
  const fullSchema: SchemaShape = {
    ...(splitSchema.server as SchemaShape),
    ...(splitSchema.client as SchemaShape),
  }

  const result = envault(fullSchema, options)
  const clientPrefix = options.clientPrefix

  if (clientPrefix && typeof window !== 'undefined') {
    const protectedKeys = new Set(
      Object.keys(splitSchema.server).filter(k => !k.startsWith(clientPrefix))
    )
    if (protectedKeys.size > 0) {
      return new Proxy(result, {
        get(target, prop: string | symbol) {
          if (typeof prop === 'string' && protectedKeys.has(prop)) {
            throw new Error(`[envault] Cannot access server-side variable "${prop}" on the client`)
          }
          return Reflect.get(target, prop)
        },
      }) as Readonly<ResolvedSchema<S & C>>
    }
  }

  return result as Readonly<ResolvedSchema<S & C>>
}
