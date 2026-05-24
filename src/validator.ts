import type {
  FieldSpec,
  ValidationError,
  StrOptions,
  NumOptions,
  BoolOptions,
  UrlOptions,
  PortOptions,
  EmailOptions,
  ListOptions,
  SecretOptions,
  JsonOptions,
  DateOptions,
  PhoneOptions,
  UuidOptions,
  SchemaShape,
} from './types.js'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const UUID_V1 = /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UUID_V3 = /^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UUID_V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UUID_VERSION_MAP: Record < number, RegExp > = { 1: UUID_V1, 3: UUID_V3, 4: UUID_V4, 5: UUID_V5 }

const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/
const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/
const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\w.-]+))?(?:\+([\w.-]+))?$/
const HEX_REGEX = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

type FieldResult = { value: unknown;error ? : ValidationError;warning ? : string }

function err(key: string, message: string): FieldResult {
  return { value: undefined, error: { key, message } }
}

function isValidIp(raw: string): boolean {
  if (IPV4_REGEX.test(raw)) {
    return raw.split('.').map(Number).every(p => p <= 255)
  }
  try {
    new URL(`http://[${raw}]`)
    return true
  } catch {
    return false
  }
}

function parseDefaultDate(val: string, transform ? : (d: Date) => unknown): Date | unknown {
  const d = new Date(val)
  return transform ? transform(d) : d
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
        return { value: parseDefaultDate(options.default as string, o.transform) }
      }
      return { value: options.default }
    }
    if (options.optional === true || options.required === false) return { value: undefined }
    return err(key, 'missing required variable')
  }
  
  switch (type) {
    case 'str': {
      const o = options as StrOptions
      if (o.minLength !== undefined && raw.length < o.minLength)
        return err(key, `must be at least ${o.minLength} characters (got ${raw.length})`)
      if (o.maxLength !== undefined && raw.length > o.maxLength)
        return err(key, `must be at most ${o.maxLength} characters (got ${raw.length})`)
      if (o.regex && !o.regex.test(raw))
        return err(key, `does not match required pattern ${o.regex.toString()}`)
      if (o.choices && !o.choices.includes(raw))
        return err(key, `must be one of: ${o.choices.join(', ')} (got "${raw}")`)
      const v = o.coerce === 'upper' ? raw.toUpperCase() :
        o.coerce === 'lower' ? raw.toLowerCase() :
        o.coerce === 'trim' ? raw.trim() :
        raw
      return { value: o.transform ? o.transform(v) : v }
    }
    
    case 'num': {
      const o = options as NumOptions
      const n = Number(raw)
      if (Number.isNaN(n)) return err(key, `"${raw}" is not a valid number`)
      if (o.integer === true && !Number.isInteger(n))
        return err(key, `must be an integer (got ${n})`)
      if (o.min !== undefined && n < o.min) return err(key, `must be ≥ ${o.min} (got ${n})`)
      if (o.max !== undefined && n > o.max) return err(key, `must be ≤ ${o.max} (got ${n})`)
      return { value: o.transform ? o.transform(n) : n }
    }
    
    case 'bool': {
      const lower = raw.toLowerCase()
      if (['true', '1', 'yes', 'on'].includes(lower)) return { value: true }
      if (['false', '0', 'no', 'off'].includes(lower)) return { value: false }
      return err(key, `"${raw}" is not a valid boolean — use true/false/1/0/yes/no/on/off`)
    }
    
    case 'url': {
      const o = options as UrlOptions
      let parsed: URL
      try {
        parsed = new URL(raw)
      } catch {
        return err(key, `"${raw}" is not a valid URL`)
      }
      const proto = parsed.protocol.replace(':', '')
      if (o.requireTls && !['https', 'wss'].includes(proto))
        return err(key, `must use a TLS protocol (https/wss), got "${proto}"`)
      if (o.protocols && !o.protocols.includes(proto))
        return err(key, `protocol must be one of: ${o.protocols.join(', ')} (got "${proto}")`)
      return { value: o.transform ? o.transform(raw) : raw }
    }
    
    case 'port': {
      const n = Number(raw)
      if (!Number.isInteger(n) || n < 1 || n > 65535)
        return err(key, `"${raw}" is not a valid port (1–65535)`)
      return { value: n }
    }
    
    case 'email': {
      const o = options as EmailOptions
      if (!EMAIL_REGEX.test(raw)) return err(key, `"${raw}" is not a valid email address`)
      return { value: o.transform ? o.transform(raw) : raw }
    }
    
    case 'json': {
      const o = options as JsonOptions
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        return err(key, `"${raw}" is not valid JSON`)
      }
      if (o.shape) {
        for (const requiredKey of o.shape) {
          if ((parsed as Record < string, unknown > )[requiredKey] === undefined) {
            return err(key, `JSON is missing required key "${requiredKey}"`)
          }
        }
      }
      return { value: o.transform ? o.transform(parsed) : parsed }
    }
    
    case 'list': {
      const o = options as ListOptions
      const sep = o.separator ?? ','
      const items = raw.split(sep).map(s => s.trim()).filter(Boolean)
      if (o.minItems !== undefined && items.length < o.minItems)
        return err(key, `must have at least ${o.minItems} items (got ${items.length})`)
      if (o.maxItems !== undefined && items.length > o.maxItems)
        return err(key, `must have at most ${o.maxItems} items (got ${items.length})`)
      if (o.choices) {
        for (const item of items) {
          if (!o.choices.includes(item))
            return err(key, `list item "${item}" must be one of: ${o.choices.join(', ')}`)
        }
      }
      return { value: o.transform ? o.transform(items) : items }
    }
    
    case 'uuid': {
      const o = options as UuidOptions
      const regex = o.version ? UUID_VERSION_MAP[o.version] : UUID_REGEX
      if (!regex || !regex.test(raw))
        return err(key, o.version ? `"${raw}" is not a valid UUID v${o.version}` : `"${raw}" is not a valid UUID`)
      return { value: raw }
    }
    
    case 'secret': {
      const o = options as SecretOptions
      if (o.minLength !== undefined && raw.length < o.minLength)
        return err(key, `must be at least ${o.minLength} characters`)
      if (o.maxLength !== undefined && raw.length > o.maxLength)
        return err(key, `must be at most ${o.maxLength} characters`)
      return { value: raw }
    }
    
    case 'date': {
      const o = options as DateOptions
      const d = new Date(raw)
      if (Number.isNaN(d.getTime())) return err(key, `"${raw}" is not a valid ISO date`)
      if (o.min && d < new Date(o.min)) return err(key, `must be on or after ${o.min}`)
      if (o.max && d > new Date(o.max)) return err(key, `must be on or before ${o.max}`)
      return { value: o.transform ? o.transform(d) : d }
    }
    
    case 'phone': {
      const o = options as PhoneOptions
      const normalized = raw.replace(/[\s\-().]/g, '')
      if (!PHONE_REGEX.test(normalized))
        return err(key, `"${raw}" is not a valid phone number (E.164 format expected, e.g. +14155552671)`)
      return { value: o.transform ? o.transform(normalized) : normalized }
    }
    
    case 'semver': {
      if (!SEMVER_REGEX.test(raw))
        return err(key, `"${raw}" is not a valid semver version (e.g. 1.2.3 or 1.0.0-beta.1)`)
      return { value: raw }
    }
    
    case 'ip': {
      if (!isValidIp(raw)) return err(key, `"${raw}" is not a valid IP address (IPv4 or IPv6)`)
      return { value: raw }
    }
    
    case 'hex': {
      if (!HEX_REGEX.test(raw))
        return err(key, `"${raw}" is not a valid hex color (e.g. #fff or #ffffff)`)
      return { value: raw.startsWith('#') ? raw : `#${raw}` }
    }
    
    default:
      return { value: raw }
  }
}

function collectSchemaEnvKeys(schema: SchemaShape): Set < string > {
  const keys = new Set < string > ()
  for (const [k, spec] of Object.entries(schema)) {
    if ('type' in spec) {
      keys.add(k)
    } else {
      for (const nestedKey of Object.keys(spec)) {
        keys.add(`${k}_${nestedKey}`.toUpperCase())
      }
    }
  }
  return keys
}

export { collectSchemaEnvKeys }

export function validateSchema(
  schema: SchemaShape,
  env: Record < string, string | undefined > ,
  isDev: boolean
): { result: Record < string, unknown > ;errors: ValidationError[];warnings: string[] } {
  const result: Record < string, unknown > = {}
  const errors: ValidationError[] = []
  const warnings: string[] = []
  
  for (const [key, spec] of Object.entries(schema)) {
    if ('type' in spec) {
      const { value, error, warning } = validateField(key, env[key], spec as FieldSpec, isDev)
      if (warning) warnings.push(warning)
      if (error) errors.push(error)
      else result[key] = value
    } else {
      const nested: Record < string, unknown > = {}
      let nestedHasError = false
      for (const [nestedKey, nestedSpec] of Object.entries(spec)) {
        if (!('type' in nestedSpec)) continue
        const envKey = `${key}_${nestedKey}`.toUpperCase()
        const { value, error, warning } = validateField(envKey, env[envKey], nestedSpec as FieldSpec, isDev)
        if (warning) warnings.push(warning)
        if (error) { errors.push(error);
          nestedHasError = true }
        else nested[nestedKey] = value
      }
      if (!nestedHasError) result[key] = nested
    }
  }
  
  return { result, errors, warnings }
}