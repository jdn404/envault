import { existsSync } from 'fs'
import type {
  FieldSpec, ValidationError, StrOptions, NumOptions, BoolOptions, UrlOptions,
  PortOptions, EmailOptions, ListOptions, SecretOptions, JsonOptions, DateOptions,
  PhoneOptions, UuidOptions, SemverOptions, IpOptions, HexOptions, CidrOptions,
  JwtOptions, Base64Options, SlugOptions, LocaleOptions, FilepathOptions,
  HashOptions, CreditCardOptions, IbanOptions, LatitudeOptions, LongitudeOptions,
  CountryOptions, CurrencyOptions, MimeTypeOptions, SchemaShape,
} from './types.js'

const UUID_REGEX    = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const UUID_V1       = /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UUID_V3       = /^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UUID_V4       = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UUID_V5       = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UUID_MAP      = { 1: UUID_V1, 3: UUID_V3, 4: UUID_V4, 5: UUID_V5 } as Record<number, RegExp>
const EMAIL_REGEX   = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/
const PHONE_REGEX   = /^\+?[1-9]\d{6,14}$/
const IPV4_REGEX    = /^(\d{1,3}\.){3}\d{1,3}$/
const SEMVER_REGEX  = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\w.-]+))?(?:\+([\w.-]+))?$/
const HEX_REGEX     = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const CIDR_V4_REGEX = /^(\d{1,3}\.){3}\d{1,3}\/(\d|[1-2]\d|3[0-2])$/
const CIDR_V6_REGEX = /^([0-9a-fA-F:]+)\/(\d|[1-9]\d|1[01]\d|12[0-8])$/
const BASE64_REGEX  = /^[A-Za-z0-9+/]*={0,2}$/
const BASE64_URL    = /^[A-Za-z0-9_-]*={0,2}$/
const SLUG_REGEX    = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const LOCALE_REGEX  = /^[a-z]{2,3}(?:-[A-Z]{2,3})?(?:-[A-Za-z]{4})?(?:-[A-Z]{2,3})?$/
const DURATION_ISO  = /^P(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$/
const MD5_REGEX     = /^[a-f0-9]{32}$/i
const SHA1_REGEX    = /^[a-f0-9]{40}$/i
const SHA256_REGEX  = /^[a-f0-9]{64}$/i
const SHA512_REGEX  = /^[a-f0-9]{128}$/i
const CRON_REGEX    = /^(\*|[0-5]?\d)(\s+(\*|[0-2]?\d)(\s+(\*|[12]?\d|3[01])(\s+(\*|1?\d|2[0-2])(\s+(\*|[0-6]))?)?)?)?$/
const JWT_REGEX     = /^[A-Za-z0-9_-]{2,}(?:\.[A-Za-z0-9_-]{2,}){2}$/
const IANA_TIMEZONES = new Set([
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'America/Honolulu', 'America/Toronto', 'America/Vancouver',
  'America/Sao_Paulo', 'America/Buenos_Aires', 'America/Lima', 'America/Bogota',
  'America/Mexico_City', 'America/Caracas', 'America/Santiago', 'America/La_Paz',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome',
  'Europe/Amsterdam', 'Europe/Brussels', 'Europe/Vienna', 'Europe/Zurich',
  'Europe/Stockholm', 'Europe/Oslo', 'Europe/Copenhagen', 'Europe/Helsinki',
  'Europe/Warsaw', 'Europe/Prague', 'Europe/Budapest', 'Europe/Bucharest',
  'Europe/Athens', 'Europe/Istanbul', 'Europe/Moscow', 'Europe/Kiev',
  'Africa/Cairo', 'Africa/Lagos', 'Africa/Nairobi', 'Africa/Johannesburg',
  'Africa/Casablanca', 'Africa/Accra', 'Africa/Abidjan', 'Africa/Tunis',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Karachi', 'Asia/Kathmandu',
  'Asia/Colombo', 'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Singapore', 'Asia/Kuala_Lumpur',
  'Asia/Manila', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Seoul',
  'Asia/Tokyo', 'Asia/Ulaanbaatar', 'Asia/Almaty', 'Asia/Tashkent',
  'Asia/Yekaterinburg', 'Asia/Novosibirsk', 'Asia/Irkutsk', 'Asia/Vladivostok',
  'Asia/Tehran', 'Asia/Jerusalem', 'Asia/Baghdad', 'Asia/Kuwait', 'Asia/Riyadh',
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth',
  'Australia/Adelaide', 'Australia/Darwin', 'Pacific/Auckland', 'Pacific/Fiji',
  'Pacific/Guam', 'Pacific/Honolulu', 'Pacific/Port_Moresby',
])
const ISO_COUNTRIES = new Set([
  'AF','AL','DZ','AD','AO','AG','AR','AM','AU','AT','AZ','BS','BH','BD','BB',
  'BY','BE','BZ','BJ','BT','BO','BA','BW','BR','BN','BG','BF','BI','CV','KH',
  'CM','CA','CF','TD','CL','CN','CO','KM','CG','CD','CR','HR','CU','CY','CZ',
  'DK','DJ','DM','DO','EC','EG','SV','GQ','ER','EE','SZ','ET','FJ','FI','FR',
  'GA','GM','GE','DE','GH','GR','GD','GT','GN','GW','GY','HT','HN','HU','IS',
  'IN','ID','IR','IQ','IE','IL','IT','JM','JP','JO','KZ','KE','KI','KP','KR',
  'KW','KG','LA','LV','LB','LS','LR','LY','LI','LT','LU','MG','MW','MY','MV',
  'ML','MT','MH','MR','MU','MX','FM','MD','MC','MN','ME','MA','MZ','MM','NA',
  'NR','NP','NL','NZ','NI','NE','NG','NO','OM','PK','PW','PA','PG','PY','PE',
  'PH','PL','PT','QA','RO','RU','RW','KN','LC','VC','WS','SM','ST','SA','SN',
  'RS','SC','SL','SG','SK','SI','SB','SO','ZA','SS','ES','LK','SD','SR','SE',
  'CH','SY','TW','TJ','TZ','TH','TL','TG','TO','TT','TN','TR','TM','TV','UG',
  'UA','AE','GB','US','UY','UZ','VU','VE','VN','YE','ZM','ZW',
])
const ISO_CURRENCIES = new Set([
  'USD','EUR','GBP','JPY','AUD','CAD','CHF','CNY','SEK','NOK','DKK','NZD',
  'MXN','SGD','HKD','KRW','TRY','INR','BRL','ZAR','RUB','PLN','THB','IDR',
  'HUF','CZK','ILS','CLP','PHP','AED','COP','SAR','MYR','RON','NGN','GHS',
  'KES','EGP','PKR','QAR','KWD','BHD','OMR','JOD','LBP','TWD','ARS','PEN',
  'VND','BGN','HRK','ISK','GEL','AMD','AZN','KZT','UZS','BDT','LKR','MMK',
])
const CREDIT_CARD_NETWORKS: Record<string, RegExp> = {
  visa:       /^4[0-9]{12}(?:[0-9]{3})?$/,
  mastercard: /^5[1-5][0-9]{14}$|^2(?:2[2-9][1-9]|[3-6][0-9]{2}|7[01][0-9]|720)[0-9]{12}$/,
  amex:       /^3[47][0-9]{13}$/,
  discover:   /^6(?:011|5[0-9]{2})[0-9]{12}$/,
  dinersclub: /^3(?:0[0-5]|[68][0-9])[0-9]{11}$/,
  jcb:        /^(?:2131|1800|35\d{3})\d{11}$/,
  unionpay:   /^62[0-9]{14,17}$/,
}

function luhnCheck(num: string): boolean {
  let sum = 0
  let alternate = false
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i])
    if (alternate) { n *= 2; if (n > 9) n -= 9 }
    sum += n
    alternate = !alternate
  }
  return sum % 10 === 0
}

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1
  }
  return 0
}

function isValidIp(raw: string): boolean {
  if (IPV4_REGEX.test(raw)) return raw.split('.').map(Number).every(p => p <= 255)
  try { new URL(`http://[${raw}]`); return true } catch { return false }
}

function isIPv4(raw: string): boolean {
  return IPV4_REGEX.test(raw) && raw.split('.').map(Number).every(p => p <= 255)
}

function isIPv6(raw: string): boolean {
  try { new URL(`http://[${raw}]`); return !isIPv4(raw) } catch { return false }
}

type FieldResult = { value: unknown; error?: ValidationError; warning?: string }

function err(key: string, message: string, type?: string): FieldResult {
  return { value: undefined, error: { key, message, type } }
}

function validateField(
  key: string,
  raw: string | undefined,
  spec: FieldSpec,
  isDev: boolean
): FieldResult {
  const { type, options } = spec

  if (options.devOnly) {
    if (!isDev) return { value: undefined }
    if ((raw === undefined || raw === '') && options.default === undefined && options.optional !== true) {
      return { value: undefined, warning: `${key} is marked devOnly but is not set in development` }
    }
  }

  if (raw === undefined || raw === '') {
    if (options.default !== undefined) {
      if (type === 'date') {
        const o = options as DateOptions
        const d = new Date(options.default as string)
        return { value: o.transform ? o.transform(d) : d }
      }
      return { value: options.default }
    }
    if (options.optional === true || options.required === false) return { value: undefined }
    return err(key, 'missing required variable', type)
  }

  switch (type) {
    case 'str': {
      const o = options as StrOptions
      if (o.notEmpty && raw.trim() === '') return err(key, 'must not be empty', type)
      if (o.minLength !== undefined && raw.length < o.minLength)
        return err(key, `must be at least ${o.minLength} characters (got ${raw.length})`, type)
      if (o.maxLength !== undefined && raw.length > o.maxLength)
        return err(key, `must be at most ${o.maxLength} characters (got ${raw.length})`, type)
      if (o.regex && !o.regex.test(raw))
        return err(key, `does not match required pattern ${o.regex.toString()}`, type)
      if (o.choices && !o.choices.includes(raw))
        return err(key, `must be one of: ${o.choices.join(', ')} (got "${raw}")`, type)
      if (o.startsWith && !raw.startsWith(o.startsWith))
        return err(key, `must start with "${o.startsWith}"`, type)
      if (o.endsWith && !raw.endsWith(o.endsWith))
        return err(key, `must end with "${o.endsWith}"`, type)
      if (o.contains && !raw.includes(o.contains))
        return err(key, `must contain "${o.contains}"`, type)
      const coerced = o.coerce === 'upper' ? raw.toUpperCase()
        : o.coerce === 'lower' ? raw.toLowerCase()
        : o.coerce === 'trim' ? raw.trim()
        : raw
      return { value: o.transform ? o.transform(coerced) : coerced }
    }

    case 'num': {
      const o = options as NumOptions
      const n = Number(raw)
      if (Number.isNaN(n)) return err(key, `"${raw}" is not a valid number`, type)
      if (o.integer && !Number.isInteger(n)) return err(key, `must be an integer (got ${n})`, type)
      if (o.positive && n <= 0) return err(key, `must be a positive number (got ${n})`, type)
      if (o.negative && n >= 0) return err(key, `must be a negative number (got ${n})`, type)
      if (o.min !== undefined && n < o.min) return err(key, `must be ≥ ${o.min} (got ${n})`, type)
      if (o.max !== undefined && n > o.max) return err(key, `must be ≤ ${o.max} (got ${n})`, type)
      if (o.multipleOf !== undefined && n % o.multipleOf !== 0)
        return err(key, `must be a multiple of ${o.multipleOf} (got ${n})`, type)
      return { value: o.transform ? o.transform(n) : n }
    }

    case 'bool': {
      const lower = raw.toLowerCase()
      if (['true', '1', 'yes', 'on'].includes(lower)) return { value: true }
      if (['false', '0', 'no', 'off'].includes(lower)) return { value: false }
      return err(key, `"${raw}" is not a valid boolean — use true/false/1/0/yes/no/on/off`, type)
    }

    case 'url': {
      const o = options as UrlOptions
      let parsed: URL
      try { parsed = new URL(raw) } catch { return err(key, `"${raw}" is not a valid URL`, type) }
      const proto = parsed.protocol.replace(':', '')
      if (o.requireTls && !['https', 'wss'].includes(proto))
        return err(key, `must use a TLS protocol (https/wss), got "${proto}"`, type)
      if (o.protocols && !o.protocols.includes(proto))
        return err(key, `protocol must be one of: ${o.protocols.join(', ')} (got "${proto}")`, type)
      if (o.requirePath && (parsed.pathname === '/' || parsed.pathname === ''))
        return err(key, 'URL must include a path', type)
      if (o.noTrailingSlash && raw.endsWith('/'))
        return err(key, 'URL must not have a trailing slash', type)
      return { value: o.transform ? o.transform(raw) : raw }
    }

    case 'port': {
      const o = options as PortOptions
      const n = Number(raw)
      const min = o.min ?? 1
      const max = o.max ?? 65535
      if (!Number.isInteger(n) || n < min || n > max)
        return err(key, `"${raw}" is not a valid port (${min}–${max})`, type)
      return { value: n }
    }

    case 'email': {
      const o = options as EmailOptions
      if (!EMAIL_REGEX.test(raw)) return err(key, `"${raw}" is not a valid email address`, type)
      const domain = raw.split('@')[1]
      if (o.allowedDomains && !o.allowedDomains.includes(domain))
        return err(key, `email domain must be one of: ${o.allowedDomains.join(', ')}`, type)
      if (o.blockedDomains && o.blockedDomains.includes(domain))
        return err(key, `email domain "${domain}" is not allowed`, type)
      return { value: o.transform ? o.transform(raw) : raw }
    }

    case 'json': {
      const o = options as JsonOptions
      let parsed: unknown
      try { parsed = JSON.parse(raw) } catch { return err(key, `"${raw}" is not valid JSON`, type) }
      if (o.shape) {
        for (const reqKey of o.shape) {
          if ((parsed as Record<string, unknown>)[reqKey] === undefined)
            return err(key, `JSON is missing required key "${reqKey}"`, type)
        }
      }
      return { value: o.transform ? o.transform(parsed) : parsed }
    }

    case 'list': {
      const o = options as ListOptions
      const sep = o.separator ?? ','
      const items = raw.split(sep).map(s => s.trim()).filter(Boolean)
      if (o.minItems !== undefined && items.length < o.minItems)
        return err(key, `must have at least ${o.minItems} items (got ${items.length})`, type)
      if (o.maxItems !== undefined && items.length > o.maxItems)
        return err(key, `must have at most ${o.maxItems} items (got ${items.length})`, type)
      if (o.choices) {
        for (const item of items) {
          if (!o.choices.includes(item))
            return err(key, `list item "${item}" must be one of: ${o.choices.join(', ')}`, type)
        }
      }
      if (o.unique && new Set(items).size !== items.length)
        return err(key, 'list items must be unique', type)
      return { value: o.transform ? o.transform(items) : items }
    }

    case 'uuid': {
      const o = options as UuidOptions
      const regex = o.version ? UUID_MAP[o.version] : UUID_REGEX
      if (!regex || !regex.test(raw))
        return err(key, o.version ? `"${raw}" is not a valid UUID v${o.version}` : `"${raw}" is not a valid UUID`, type)
      return { value: raw }
    }

    case 'secret': {
      const o = options as SecretOptions
      if (o.minLength !== undefined && raw.length < o.minLength)
        return err(key, `must be at least ${o.minLength} characters`, type)
      if (o.maxLength !== undefined && raw.length > o.maxLength)
        return err(key, `must be at most ${o.maxLength} characters`, type)
      return { value: raw }
    }

    case 'date': {
      const o = options as DateOptions
      const d = new Date(raw)
      if (Number.isNaN(d.getTime())) return err(key, `"${raw}" is not a valid ISO date`, type)
      if (o.min && d < new Date(o.min)) return err(key, `must be on or after ${o.min}`, type)
      if (o.max && d > new Date(o.max)) return err(key, `must be on or before ${o.max}`, type)
      if (o.future && d <= new Date()) return err(key, 'must be a future date', type)
      if (o.past && d >= new Date()) return err(key, 'must be a past date', type)
      return { value: o.transform ? o.transform(d) : d }
    }

    case 'phone': {
      const o = options as PhoneOptions
      const normalized = raw.replace(/[\s\-().]/g, '')
      if (!PHONE_REGEX.test(normalized))
        return err(key, `"${raw}" is not a valid phone number (E.164 format, e.g. +14155552671)`, type)
      return { value: o.transform ? o.transform(normalized) : normalized }
    }

    case 'semver': {
      const o = options as SemverOptions
      if (!SEMVER_REGEX.test(raw))
        return err(key, `"${raw}" is not a valid semver version (e.g. 1.2.3 or 1.0.0-beta.1)`, type)
      const core = raw.split('-')[0]
      if (o.minVersion && compareSemver(core, o.minVersion) < 0)
        return err(key, `must be ≥ ${o.minVersion} (got ${raw})`, type)
      if (o.maxVersion && compareSemver(core, o.maxVersion) > 0)
        return err(key, `must be ≤ ${o.maxVersion} (got ${raw})`, type)
      return { value: raw }
    }

    case 'ip': {
      const o = options as IpOptions
      if (o.version === 4 && !isIPv4(raw)) return err(key, `"${raw}" is not a valid IPv4 address`, type)
      if (o.version === 6 && !isIPv6(raw)) return err(key, `"${raw}" is not a valid IPv6 address`, type)
      if (!o.version && !isValidIp(raw)) return err(key, `"${raw}" is not a valid IP address (IPv4 or IPv6)`, type)
      return { value: raw }
    }

    case 'hex': {
      if (!HEX_REGEX.test(raw)) return err(key, `"${raw}" is not a valid hex color (e.g. #fff or #ffffff)`, type)
      return { value: raw.startsWith('#') ? raw : `#${raw}` }
    }

    case 'cidr': {
      const o = options as CidrOptions
      if (o.version === 4 && !CIDR_V4_REGEX.test(raw))
        return err(key, `"${raw}" is not a valid IPv4 CIDR notation (e.g. 192.168.0.0/24)`, type)
      if (o.version === 6 && !CIDR_V6_REGEX.test(raw))
        return err(key, `"${raw}" is not a valid IPv6 CIDR notation`, type)
      if (!o.version && !CIDR_V4_REGEX.test(raw) && !CIDR_V6_REGEX.test(raw))
        return err(key, `"${raw}" is not a valid CIDR notation (e.g. 192.168.0.0/24 or ::1/128)`, type)
      return { value: raw }
    }

    case 'jwt': {
      if (!JWT_REGEX.test(raw)) return err(key, `"${raw}" is not a valid JWT format (header.payload.signature)`, type)
      return { value: raw }
    }

    case 'base64': {
      const o = options as Base64Options
      const regex = o.urlSafe ? BASE64_URL : BASE64_REGEX
      if (!regex.test(raw)) return err(key, `"${raw}" is not valid ${o.urlSafe ? 'base64url' : 'base64'}`, type)
      return { value: raw }
    }

    case 'slug': {
      const o = options as SlugOptions
      if (!SLUG_REGEX.test(raw)) return err(key, `"${raw}" is not a valid slug (lowercase letters, numbers, hyphens only)`, type)
      if (o.minLength && raw.length < o.minLength) return err(key, `must be at least ${o.minLength} characters`, type)
      if (o.maxLength && raw.length > o.maxLength) return err(key, `must be at most ${o.maxLength} characters`, type)
      return { value: raw }
    }

    case 'locale': {
      const o = options as LocaleOptions
      if (!LOCALE_REGEX.test(raw)) return err(key, `"${raw}" is not a valid locale code (e.g. en, en-US, zh-Hans-CN)`, type)
      if (o.allowedLocales && !o.allowedLocales.includes(raw))
        return err(key, `locale must be one of: ${o.allowedLocales.join(', ')} (got "${raw}")`, type)
      return { value: raw }
    }

    case 'timezone': {
      if (!IANA_TIMEZONES.has(raw)) {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: raw })
        } catch {
          return err(key, `"${raw}" is not a valid IANA timezone (e.g. America/New_York, Europe/London)`, type)
        }
      }
      return { value: raw }
    }

    case 'cron': {
      if (!CRON_REGEX.test(raw.trim()))
        return err(key, `"${raw}" is not a valid cron expression (e.g. "0 * * * *" or "*/5 * * * *")`, type)
      return { value: raw.trim() }
    }

    case 'duration': {
      if (!DURATION_ISO.test(raw) || raw === 'P')
        return err(key, `"${raw}" is not a valid ISO 8601 duration (e.g. P1Y2M3DT4H5M6S or PT30M)`, type)
      return { value: raw }
    }

    case 'filepath': {
      const o = options as FilepathOptions
      if (o.mustExist && !existsSync(raw))
        return err(key, `path "${raw}" does not exist`, type)
      if (o.extensions) {
        const hasExt = o.extensions.some(ext => raw.endsWith(ext))
        if (!hasExt) return err(key, `file must have one of these extensions: ${o.extensions.join(', ')}`, type)
      }
      return { value: raw }
    }

    case 'hash': {
      const o = options as HashOptions
      const algo = o.algorithm ?? 'sha256'
      const regexMap = { md5: MD5_REGEX, sha1: SHA1_REGEX, sha256: SHA256_REGEX, sha512: SHA512_REGEX }
      const regex = regexMap[algo]
      if (regex && !regex.test(raw))
        return err(key, `"${raw}" is not a valid ${algo.toUpperCase()} hash`, type)
      return { value: raw }
    }

    case 'creditcard': {
      const o = options as CreditCardOptions
      const digits = raw.replace(/[\s-]/g, '')
      if (!/^\d{13,19}$/.test(digits)) return err(key, 'not a valid credit card number format', type)
      if (!luhnCheck(digits)) return err(key, 'credit card number failed Luhn validation', type)
      if (o.allowedNetworks) {
        const detected = Object.entries(CREDIT_CARD_NETWORKS).find(([, regex]) => regex.test(digits))?.[0]
        if (!detected || !o.allowedNetworks.includes(detected))
          return err(key, `card network must be one of: ${o.allowedNetworks.join(', ')}`, type)
      }
      return { value: digits }
    }

    case 'iban': {
      const o = options as IbanOptions
      const normalized = raw.replace(/\s/g, '').toUpperCase()
      if (!/^[A-Z]{2}\d{2}[A-Z0-9]{4,32}$/.test(normalized))
        return err(key, `"${raw}" is not a valid IBAN format`, type)
      if (o.allowedCountries) {
        const countryCode = normalized.slice(0, 2)
        if (!o.allowedCountries.includes(countryCode))
          return err(key, `IBAN country must be one of: ${o.allowedCountries.join(', ')}`, type)
      }
      return { value: normalized }
    }

    case 'latitude': {
      const n = Number(raw)
      if (Number.isNaN(n) || n < -90 || n > 90)
        return err(key, `"${raw}" is not a valid latitude (-90 to 90)`, type)
      return { value: n }
    }

    case 'longitude': {
      const n = Number(raw)
      if (Number.isNaN(n) || n < -180 || n > 180)
        return err(key, `"${raw}" is not a valid longitude (-180 to 180)`, type)
      return { value: n }
    }

    case 'country': {
      const o = options as CountryOptions
      const upper = raw.toUpperCase()
      if (!ISO_COUNTRIES.has(upper))
        return err(key, `"${raw}" is not a valid ISO 3166-1 alpha-2 country code (e.g. US, GB, NG)`, type)
      if (o.allowedCountries && !o.allowedCountries.includes(upper))
        return err(key, `country must be one of: ${o.allowedCountries.join(', ')}`, type)
      return { value: upper }
    }

    case 'currency': {
      const o = options as CurrencyOptions
      const upper = raw.toUpperCase()
      if (!ISO_CURRENCIES.has(upper))
        return err(key, `"${raw}" is not a valid ISO 4217 currency code (e.g. USD, EUR, NGN)`, type)
      if (o.allowedCurrencies && !o.allowedCurrencies.includes(upper))
        return err(key, `currency must be one of: ${o.allowedCurrencies.join(', ')}`, type)
      return { value: upper }
    }

    case 'mimetype': {
      const o = options as MimeTypeOptions
      if (!/^[a-z]+\/[a-z0-9][a-z0-9!#$&\-^_]*(?:\+[a-z0-9]+)?$/.test(raw))
        return err(key, `"${raw}" is not a valid MIME type (e.g. application/json, image/png)`, type)
      if (o.allowedTypes && !o.allowedTypes.includes(raw))
        return err(key, `MIME type must be one of: ${o.allowedTypes.join(', ')}`, type)
      return { value: raw }
    }

    default:
      return { value: raw }
  }
}

export function collectSchemaEnvKeys(schema: SchemaShape): Set<string> {
  const keys = new Set<string>()
  for (const [k, spec] of Object.entries(schema)) {
    if ('type' in spec) keys.add(k)
    else for (const nk of Object.keys(spec)) keys.add(`${k}_${nk}`.toUpperCase())
  }
  return keys
}

export function validateSchema(
  schema: SchemaShape,
  env: Record<string, string | undefined>,
  isDev: boolean
): { result: Record<string, unknown>; errors: ValidationError[]; warnings: string[] } {
  const result: Record<string, unknown> = {}
  const errors: ValidationError[] = []
  const warnings: string[] = []

  for (const [key, spec] of Object.entries(schema)) {
    if ('type' in spec) {
      const { value, error, warning } = validateField(key, env[key], spec as FieldSpec, isDev)
      if (warning) warnings.push(warning)
      if (error) errors.push(error)
      else result[key] = value
    } else {
      const nested: Record<string, unknown> = {}
      let nestedHasError = false
      for (const [nk, ns] of Object.entries(spec)) {
        if (!('type' in ns)) continue
        const envKey = `${key}_${nk}`.toUpperCase()
        const { value, error, warning } = validateField(envKey, env[envKey], ns as FieldSpec, isDev)
        if (warning) warnings.push(warning)
        if (error) { errors.push(error); nestedHasError = true }
        else nested[nk] = value
      }
      if (!nestedHasError) result[key] = nested
    }
  }

  return { result, errors, warnings }
}
