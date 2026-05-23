import type { StrOptions, NumOptions, BoolOptions, UrlOptions, PortOptions, EmailOptions, JsonOptions, ListOptions, FieldSpec } from '../types.js'

export const str = (options: StrOptions = {}): FieldSpec => ({ type: 'str', options })
export const num = (options: NumOptions = {}): FieldSpec => ({ type: 'num', options })
export const bool = (options: BoolOptions = {}): FieldSpec => ({ type: 'bool', options })
export const url = (options: UrlOptions = {}): FieldSpec => ({ type: 'url', options })
export const port = (options: PortOptions = {}): FieldSpec => ({ type: 'port', options })
export const email = (options: EmailOptions = {}): FieldSpec => ({ type: 'email', options })
export const json = (options: JsonOptions = {}): FieldSpec => ({ type: 'json', options })
export const list = (options: ListOptions = {}): FieldSpec => ({ type: 'list', options })
