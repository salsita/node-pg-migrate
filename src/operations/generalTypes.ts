import type PgLiteral from './PgLiteral';

/**
 * Type that provides auto-suggestions but also any string.
 *
 * @see https://github.com/microsoft/TypeScript/issues/29729#issuecomment-471566609
 */
export type LiteralUnion<TSuggested extends TBase, TBase = string> =
  | TSuggested
  | (TBase & { zz_IGNORE_ME?: never });

export type PublicPart<T> = { [K in keyof T]: T[K] };

export type Nullable<T> = { [P in keyof T]: T[P] | null };

export type PgLiteralValue = PublicPart<PgLiteral>;

export type Value =
  | null
  | boolean
  | string
  | number
  | PgLiteral
  | PgLiteralValue
  | Value[];

export type Type = string | { type: string };

export type Name = string | { schema?: string; name: string };

export interface IfNotExistsOption {
  ifNotExists?: boolean;
}

export interface IfExistsOption {
  ifExists?: boolean;
}

export interface CascadeOption {
  cascade?: boolean;
}

export type DropOptions = IfExistsOption & CascadeOption;
