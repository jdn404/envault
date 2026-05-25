export type ValidatorType =
  | 'str' | 'num' | 'bool' | 'url' | 'port' | 'email' | 'json' | 'list'
  | 'uuid' | 'secret' | 'date' | 'phone' | 'semver' | 'ip' | 'hex'
  | 'cidr' | 'jwt' | 'base64' | 'slug' | 'locale' | 'timezone' | 'cron'
  | 'duration' | 'filepath' | 'hash' | 'creditcard' | 'iban'
  | 'latitude' | 'longitude' | 'country' | 'currency' | 'mimetype'

export interface BaseOptions {
  default?: unknown
  optional?: boolean
  required?: boolean
  description?: string
  devOnly?: boolean
  example?: string
  group?: string
  sensitive?: boolean
  deprecated?: boolean | string
  transform?: (val: unknown) => unknown
}

export interface StrOptions extends BaseOptions {
  default?: string
  minLength?: number
  maxLength?: number
  regex?: RegExp
  choices?: readonly string[]
  coerce?: 'upper' | 'lower' | 'trim'
  transform?: (val: string) => unknown
  notEmpty?: boolean
  startsWith?: string
  endsWith?: string
  contains?: string
}

export interface NumOptions extends BaseOptions {
  default?: number
  min?: number
  max?: number
  integer?: boolean
  positive?: boolean
  negative?: boolean
  multipleOf?: number
  transform?: (val: number) => unknown
}

export interface BoolOptions extends BaseOptions {
  default?: boolean
}

export interface UrlOptions extends BaseOptions {
  default?: string
  protocols?: readonly string[]
  requireTls?: boolean
  requirePath?: boolean
  noTrailingSlash?: boolean
  transform?: (val: string) => unknown
}

export interface PortOptions extends BaseOptions {
  default?: number
  min?: number
  max?: number
}

export interface EmailOptions extends BaseOptions {
  default?: string
  allowedDomains?: readonly string[]
  blockedDomains?: readonly string[]
  transform?: (val: string) => unknown
}

export interface JsonOptions<T = unknown> extends BaseOptions {
  default?: T
  shape?: readonly string[]
  transform?: (val: unknown) => unknown
}

export interface ListOptions extends BaseOptions {
  default?: string[]
  separator?: string
  minItems?: number
  maxItems?: number
  choices?: readonly string[]
  unique?: boolean
  transform?: (val: string[]) => unknown
}

export interface UuidOptions extends BaseOptions {
  default?: string
  version?: 1 | 3 | 4 | 5
}

export interface SecretOptions extends BaseOptions {
  default?: string
  minLength?: number
  maxLength?: number
  minEntropy?: number
}

export interface DateOptions extends BaseOptions {
  default?: string
  min?: string
  max?: string
  future?: boolean
  past?: boolean
  transform?: (val: Date) => unknown
}

export interface PhoneOptions extends BaseOptions {
  default?: string
  transform?: (val: string) => unknown
}

export interface SemverOptions extends BaseOptions {
  default?: string
  minVersion?: string
  maxVersion?: string
}

export interface IpOptions extends BaseOptions {
  default?: string
  version?: 4 | 6
}

export interface HexOptions extends BaseOptions {
  default?: string
}

export interface CidrOptions extends BaseOptions {
  default?: string
  version?: 4 | 6
}

export interface JwtOptions extends BaseOptions {
  default?: string
  algorithms?: readonly string[]
}

export interface Base64Options extends BaseOptions {
  default?: string
  urlSafe?: boolean
}

export interface SlugOptions extends BaseOptions {
  default?: string
  minLength?: number
  maxLength?: number
}

export interface LocaleOptions extends BaseOptions {
  default?: string
  allowedLocales?: readonly string[]
}

export interface TimezoneOptions extends BaseOptions {
  default?: string
}

export interface CronOptions extends BaseOptions {
  default?: string
}

export interface DurationOptions extends BaseOptions {
  default?: string
}

export interface FilepathOptions extends BaseOptions {
  default?: string
  mustExist?: boolean
  extensions?: readonly string[]
}

export interface HashOptions extends BaseOptions {
  default?: string
  algorithm?: 'md5' | 'sha1' | 'sha256' | 'sha512'
}

export interface CreditCardOptions extends BaseOptions {
  default?: string
  allowedNetworks?: readonly string[]
}

export interface IbanOptions extends BaseOptions {
  default?: string
  allowedCountries?: readonly string[]
}

export interface LatitudeOptions extends BaseOptions {
  default?: number
}

export interface LongitudeOptions extends BaseOptions {
  default?: number
}

export interface CountryOptions extends BaseOptions {
  default?: string
  allowedCountries?: readonly string[]
}

export interface CurrencyOptions extends BaseOptions {
  default?: string
  allowedCurrencies?: readonly string[]
}

export interface MimeTypeOptions extends BaseOptions {
  default?: string
  allowedTypes?: readonly string[]
}

export interface FieldSpec {
  type: ValidatorType
  options:
    | StrOptions | NumOptions | BoolOptions | UrlOptions | PortOptions
    | EmailOptions | JsonOptions | ListOptions | UuidOptions | SecretOptions
    | DateOptions | PhoneOptions | SemverOptions | IpOptions | HexOptions
    | CidrOptions | JwtOptions | Base64Options | SlugOptions | LocaleOptions
    | TimezoneOptions | CronOptions | DurationOptions | FilepathOptions
    | HashOptions | CreditCardOptions | IbanOptions | LatitudeOptions
    | LongitudeOptions | CountryOptions | CurrencyOptions | MimeTypeOptions
}

export type NestedSchema = Record<string, FieldSpec>
export type SchemaShape = Record<string, FieldSpec | NestedSchema>

export interface ValidationError {
  key: string
  message: string
  type?: string
}

export type EnvRecord = Record<string, unknown>

export type ConditionalRule = {
  when: (env: EnvRecord) => boolean
  require: string[]
  message?: string
}

export type CrossFieldRule = {
  fields: readonly string[]
  validate: (values: EnvRecord) => string | null
}

export interface WatchEvent {
  type: 'added' | 'removed' | 'changed'
  key: string
  oldValue?: string
  newValue?: string
  timestamp?: number
}

export interface DocsOptions {
  title?: string
  description?: string
  format?: 'markdown' | 'html' | 'json'
  output?: string
  includeDefaults?: boolean
  includeExamples?: boolean
  groupBy?: 'prefix' | 'group' | 'none'
}

export interface EnvaultOptions {
  path?: string | string[]
  override?: boolean
  environment?: string
  onError?: (errors: ValidationError[]) => void
  onWarn?: (warnings: string[]) => void
  throws?: boolean
  strict?: boolean
  clientPrefix?: string
  rules?: ConditionalRule[]
  crossRules?: CrossFieldRule[]
  errorFormat?: 'pretty' | 'json' | 'minimal'
}

type IsOptional<O> =
  O extends { optional: true } ? true
  : O extends { required: false } ? true
  : false

type ResolveValidatorType<T extends ValidatorType> =
  T extends 'str' ? string
  : T extends 'num' ? number
  : T extends 'bool' ? boolean
  : T extends 'url' ? string
  : T extends 'port' ? number
  : T extends 'email' ? string
  : T extends 'json' ? unknown
  : T extends 'list' ? string[]
  : T extends 'uuid' ? string
  : T extends 'secret' ? string
  : T extends 'date' ? Date
  : T extends 'phone' ? string
  : T extends 'semver' ? string
  : T extends 'ip' ? string
  : T extends 'hex' ? string
  : T extends 'cidr' ? string
  : T extends 'jwt' ? string
  : T extends 'base64' ? string
  : T extends 'slug' ? string
  : T extends 'locale' ? string
  : T extends 'timezone' ? string
  : T extends 'cron' ? string
  : T extends 'duration' ? string
  : T extends 'filepath' ? string
  : T extends 'hash' ? string
  : T extends 'creditcard' ? string
  : T extends 'iban' ? string
  : T extends 'latitude' ? number
  : T extends 'longitude' ? number
  : T extends 'country' ? string
  : T extends 'currency' ? string
  : T extends 'mimetype' ? string
  : never

type ResolveField<F extends FieldSpec> =
  IsOptional<F['options']> extends true
    ? ResolveValidatorType<F['type']> | undefined
    : ResolveValidatorType<F['type']>

export type ResolvedSchema<T extends SchemaShape> = {
  [K in keyof T]: T[K] extends FieldSpec
    ? ResolveField<T[K]>
    : T[K] extends NestedSchema
      ? { [NK in keyof T[K]]: T[K][NK] extends FieldSpec ? ResolveField<T[K][NK]> : never }
      : never
}

export type InferEnv<T extends SchemaShape> = ResolvedSchema<T>
