export type ValidatorType = 'str' | 'num' | 'bool' | 'url' | 'port' | 'email' | 'json' | 'list'

export interface BaseOptions {
  default?: unknown
  optional?: boolean
  required?: boolean
  description?: string | string
}

export interface StrOptions extends BaseOptions {
  default?: string
  minLength?: number
  maxLength?: number
  regex?: RegExp
  choices?: string[]
}

export interface NumOptions extends BaseOptions {
  default?: number
  min?: number
  max?: number
}

export interface BoolOptions extends BaseOptions {
  default?: boolean
}

export interface UrlOptions extends BaseOptions {
  default?: string
  protocols?: string[]
}

export interface PortOptions extends BaseOptions {
  default?: number
}

export interface EmailOptions extends BaseOptions {
  default?: string
}

export interface JsonOptions extends BaseOptions {
  default?: unknown
}

export interface ListOptions extends BaseOptions {
  default?: string[]
  separator?: string
}

export interface FieldSpec {
  type: ValidatorType
  options: BaseOptions
}

export type SchemaShape = {
  [key: string]: FieldSpec | NestedSchema
}

export type NestedSchema = {
  [key: string]: FieldSpec | NestedSchema
}

export type InferType<T extends FieldSpec> =
  T['type'] extends 'str' ? string :
  T['type'] extends 'num' ? number :
  T['type'] extends 'bool' ? boolean :
  T['type'] extends 'url' ? string :
  T['type'] extends 'port' ? number :
  T['type'] extends 'email' ? string :
  T['type'] extends 'json' ? unknown :
  T['type'] extends 'list' ? string[] :
  never

export interface ValidationError {
  key: string
  message: string
}
