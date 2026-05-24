import type {
  StrOptions,
  NumOptions,
  BoolOptions,
  UrlOptions,
  PortOptions,
  EmailOptions,
  JsonOptions,
  ListOptions,
  UuidOptions,
  SecretOptions,
  DateOptions,
  PhoneOptions,
  SemverOptions,
  IpOptions,
  HexOptions,
  FieldSpec,
} from '../types.js'

export const str    = (options: StrOptions = {}): FieldSpec    => ({ type: 'str',    options })
export const num    = (options: NumOptions = {}): FieldSpec    => ({ type: 'num',    options })
export const bool   = (options: BoolOptions = {}): FieldSpec   => ({ type: 'bool',   options })
export const url    = (options: UrlOptions = {}): FieldSpec    => ({ type: 'url',    options })
export const port   = (options: PortOptions = {}): FieldSpec   => ({ type: 'port',   options })
export const email  = (options: EmailOptions = {}): FieldSpec  => ({ type: 'email',  options })
export const json   = <T = unknown>(options: JsonOptions<T> = {}): FieldSpec => ({ type: 'json', options })
export const list   = (options: ListOptions = {}): FieldSpec   => ({ type: 'list',   options })
export const uuid   = (options: UuidOptions = {}): FieldSpec   => ({ type: 'uuid',   options })
export const secret = (options: SecretOptions = {}): FieldSpec => ({ type: 'secret', options })
export const date   = (options: DateOptions = {}): FieldSpec   => ({ type: 'date',   options })
export const phone  = (options: PhoneOptions = {}): FieldSpec  => ({ type: 'phone',  options })
export const semver = (options: SemverOptions = {}): FieldSpec => ({ type: 'semver', options })
export const ip     = (options: IpOptions = {}): FieldSpec     => ({ type: 'ip',     options })
export const hex    = (options: HexOptions = {}): FieldSpec    => ({ type: 'hex',    options })

export const enm = (choices: readonly string[], options: Omit<StrOptions, 'choices'> = {}): FieldSpec =>
  ({ type: 'str', options: { ...options, choices } })
