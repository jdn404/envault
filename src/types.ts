export type ValidatorType =
  | 'str'
  | 'num'
  | 'bool'
  | 'url'
  | 'port'
  | 'email'
  | 'json'
  | 'list'
  | 'uuid'
  | 'secret'
  | 'date'
  | 'phone'
  | 'semver'
  | 'ip'
  | 'hex'

export interface BaseOptions {
  default?: unknown
  optional?: boolean
  required?: boolean
  description?: string
  devOnly?: boolean
}

export interface StrOptions extends BaseOptions {
  default?: string
  minLength?: number
  maxLength?: number
  regex?: RegExp
  choices?: readonly string[]
  coerce?: 'upper' | 'lower' | 'trim'
  transform?: (val: string) => unknown
}

export interface NumOptions extends BaseOptions {
  default?: number
  min?: number
  max?: number
  integer?: boolean
  transform?: (val: number) => unknown
}

export interface BoolOptions extends BaseOptions {
  default?: boolean
}

export interface UrlOptions extends BaseOptions {
  default?: string
  protocols?: readonly string[]
  requireTls?: boolean
  transform?: (val: string) => unknown
}

export interface PortOptions extends BaseOptions {
  default?: number
}

export interface EmailOptions extends BaseOptions {
  default?: string
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
}

export interface DateOptions extends BaseOptions {
  default?: string
  min?: string
  max?: string
  transform?: (val: Date) => unknown
}

export interface PhoneOptions extends BaseOptions {
  default?: string
  transform?: (val: string) => unknown
}

export interface SemverOptions extends BaseOptions {
  default?: string
}

export interface IpOptions extends BaseOptions {
  default?: string
}

export interface HexOptions extends BaseOptions {
  default?: string
}

export interface FieldSpec {
  type: ValidatorType
  options:
    | StrOptions
    | NumOptions
    | BoolOptions
    | UrlOptions
    | PortOptions
    | EmailOptions
    | JsonOptions
    | ListOptions
    | UuidOptions
    | SecretOptions
    | DateOptions
    | PhoneOptions
    | SemverOptions
    | IpOptions
    | HexOptions
}

export type NestedSchema = Record<string, FieldSpec>
export type SchemaShape = Record<string, FieldSpec | NestedSchema>

export interface ValidationError {
  key: string
  message: string
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
}

type IsOptional<O> =
  O extends { optional: true }
    ? true
    : O extends { required: false }
      ? true
      : false

type ResolveValidatorType<T extends ValidatorType> =
  T extends 'str'    ? string
  : T extends 'num'  ? number
  : T extends 'bool' ? boolean
  : T extends 'url'  ? string
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
