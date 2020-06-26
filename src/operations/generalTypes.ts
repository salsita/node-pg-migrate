import PgLiteral from './PgLiteral'

// eslint-disable-next-line camelcase
export type LiteralUnion<T extends U, U = string> = T | (U & { zz_IGNORE_ME?: never })

export type Nullable<T> = { [P in keyof T]: T[P] | null }

export type Value = null | boolean | string | number | PgLiteral | Value[]

export type Type = string | { type: string }

export type Name = string | { schema?: string; name: string }

export interface IfNotExistsOption {
  ifNotExists?: boolean
}

export interface IfExistsOption {
  ifExists?: boolean
}

export interface CascadeOption {
  cascade?: boolean
}

export type DropOptions = IfExistsOption & CascadeOption
