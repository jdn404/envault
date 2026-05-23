import type { FieldSpec, ValidationError, StrOptions, NumOptions, BoolOptions, UrlOptions, PortOptions, ListOptions } from './types.js'

function validateField(key: string, raw: string | undefined, spec: FieldSpec): { value: unknown; error?: ValidationError } {
  const { type, options } = spec

  if (raw === undefined || raw === '') {
    if (options.default !== undefined) return { value: options.default }
    if (options.optional === true) return { value: undefined }
    if (options.required === false) return { value: undefined }
    return { value: undefined, error: { key, message: 'missing required variable' } }
  }

  switch (type) {
    case 'str': {
      const o = options as StrOptions
      if (o.minLength !== undefined && raw.length < o.minLength)
        return { value: undefined, error: { key, message: `must be at least ${o.minLength} characters (got ${raw.length})` } }
      if (o.maxLength !== undefined && raw.length > o.maxLength)
        return { value: undefined, error: { key, message: `must be at most ${o.maxLength} characters (got ${raw.length})` } }
      if (o.regex && !o.regex.test(raw))
        return { value: undefined, error: { key, message: `does not match required pattern` } }
      if (o.choices && !o.choices.includes(raw))
        return { value: undefined, error: { key, message: `must be one of: ${o.choices.join(', ')} (got "${raw}")` } }
      return { value: raw }
    }

    case 'num': {
      const o = options as NumOptions
      const n = Number(raw)
      if (isNaN(n)) return { value: undefined, error: { key, message: `"${raw}" is not a valid number` } }
      if (o.min !== undefined && n < o.min) return { value: undefined, error: { key, message: `must be at least ${o.min} (got ${n})` } }
      if (o.max !== undefined && n > o.max) return { value: undefined, error: { key, message: `must be at most ${o.max} (got ${n})` } }
      return { value: n }
    }

    case 'bool': {
      if (['true', '1', 'yes'].includes(raw.toLowerCase())) return { value: true }
      if (['false', '0', 'no'].includes(raw.toLowerCase())) return { value: false }
      return { value: undefined, error: { key, message: `"${raw}" is not a valid boolean (use true/false/1/0)` } }
    }

    case 'url': {
      const o = options as UrlOptions
      try {
        const parsed = new URL(raw)
        if (o.protocols && !o.protocols.includes(parsed.protocol.replace(':', '')))
          return { value: undefined, error: { key, message: `protocol must be one of: ${o.protocols.join(', ')}` } }
        return { value: raw }
      } catch {
        return { value: undefined, error: { key, message: `"${raw}" is not a valid URL` } }
      }
    }

    case 'port': {
      const o = options as PortOptions
      const n = Number(raw)
      if (!Number.isInteger(n) || n < 1 || n > 65535)
        return { value: undefined, error: { key, message: `"${raw}" is not a valid port number (1-65535)` } }
      void o
      return { value: n }
    }

    case 'email': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(raw)) return { value: undefined, error: { key, message: `"${raw}" is not a valid email address` } }
      return { value: raw }
    }

    case 'json': {
      try {
        return { value: JSON.parse(raw) }
      } catch {
        return { value: undefined, error: { key, message: `"${raw}" is not valid JSON` } }
      }
    }

    case 'list': {
      const o = options as ListOptions
      const sep = o.separator ?? ','
      return { value: raw.split(sep).map(s => s.trim()).filter(Boolean) }
    }

    default:
      return { value: raw }
  }
}

export function validateSchema(
  schema: Record<string, FieldSpec | Record<string, FieldSpec>>,
  env: Record<string, string | undefined>
): { result: Record<string, unknown>; errors: ValidationError[] } {
  const result: Record<string, unknown> = {}
  const errors: ValidationError[] = []

  for (const [key, spec] of Object.entries(schema)) {
    if ('type' in spec) {
      const { value, error } = validateField(key, env[key], spec as FieldSpec)
      if (error) errors.push(error)
      else result[key] = value
    } else {
      const nested: Record<string, unknown> = {}
      for (const [nestedKey, nestedSpec] of Object.entries(spec)) {
        const envKey = `${key}_${nestedKey}`.toUpperCase()
        const { value, error } = validateField(envKey, env[envKey], nestedSpec as FieldSpec)
        if (error) errors.push(error)
        else nested[nestedKey] = value
      }
      result[key] = nested
    }
  }

  return { result, errors }
}
