import type {
  StrOptions, NumOptions, BoolOptions, UrlOptions, PortOptions, EmailOptions,
  JsonOptions, ListOptions, UuidOptions, SecretOptions, DateOptions, PhoneOptions,
  SemverOptions, IpOptions, HexOptions, CidrOptions, JwtOptions, Base64Options,
  SlugOptions, LocaleOptions, TimezoneOptions, CronOptions, DurationOptions,
  FilepathOptions, HashOptions, CreditCardOptions, IbanOptions, LatitudeOptions,
  LongitudeOptions, CountryOptions, CurrencyOptions, MimeTypeOptions, FieldSpec,
} from '../types.js'

export const str        = (options: StrOptions = {}): FieldSpec        => ({ type: 'str',        options })
export const num        = (options: NumOptions = {}): FieldSpec         => ({ type: 'num',        options })
export const bool       = (options: BoolOptions = {}): FieldSpec        => ({ type: 'bool',       options })
export const url        = (options: UrlOptions = {}): FieldSpec         => ({ type: 'url',        options })
export const port       = (options: PortOptions = {}): FieldSpec        => ({ type: 'port',       options })
export const email      = (options: EmailOptions = {}): FieldSpec       => ({ type: 'email',      options })
export const json       = <T = unknown>(options: JsonOptions<T> = {}): FieldSpec => ({ type: 'json', options })
export const list       = (options: ListOptions = {}): FieldSpec        => ({ type: 'list',       options })
export const uuid       = (options: UuidOptions = {}): FieldSpec        => ({ type: 'uuid',       options })
export const secret     = (options: SecretOptions = {}): FieldSpec      => ({ type: 'secret',     options })
export const date       = (options: DateOptions = {}): FieldSpec        => ({ type: 'date',       options })
export const phone      = (options: PhoneOptions = {}): FieldSpec       => ({ type: 'phone',      options })
export const semver     = (options: SemverOptions = {}): FieldSpec      => ({ type: 'semver',     options })
export const ip         = (options: IpOptions = {}): FieldSpec          => ({ type: 'ip',         options })
export const hex        = (options: HexOptions = {}): FieldSpec         => ({ type: 'hex',        options })
export const cidr       = (options: CidrOptions = {}): FieldSpec        => ({ type: 'cidr',       options })
export const jwt        = (options: JwtOptions = {}): FieldSpec         => ({ type: 'jwt',        options })
export const base64     = (options: Base64Options = {}): FieldSpec      => ({ type: 'base64',     options })
export const slug       = (options: SlugOptions = {}): FieldSpec        => ({ type: 'slug',       options })
export const locale     = (options: LocaleOptions = {}): FieldSpec      => ({ type: 'locale',     options })
export const timezone   = (options: TimezoneOptions = {}): FieldSpec    => ({ type: 'timezone',   options })
export const cron       = (options: CronOptions = {}): FieldSpec        => ({ type: 'cron',       options })
export const duration   = (options: DurationOptions = {}): FieldSpec    => ({ type: 'duration',   options })
export const filepath   = (options: FilepathOptions = {}): FieldSpec    => ({ type: 'filepath',   options })
export const hash       = (options: HashOptions = {}): FieldSpec        => ({ type: 'hash',       options })
export const creditcard = (options: CreditCardOptions = {}): FieldSpec  => ({ type: 'creditcard', options })
export const iban       = (options: IbanOptions = {}): FieldSpec        => ({ type: 'iban',       options })
export const latitude   = (options: LatitudeOptions = {}): FieldSpec    => ({ type: 'latitude',   options })
export const longitude  = (options: LongitudeOptions = {}): FieldSpec   => ({ type: 'longitude',  options })
export const country    = (options: CountryOptions = {}): FieldSpec     => ({ type: 'country',    options })
export const currency   = (options: CurrencyOptions = {}): FieldSpec    => ({ type: 'currency',   options })
export const mimetype   = (options: MimeTypeOptions = {}): FieldSpec    => ({ type: 'mimetype',   options })

export const enm = (choices: readonly string[], options: Omit<StrOptions, 'choices'> = {}): FieldSpec =>
  ({ type: 'str', options: { ...options, choices } })
