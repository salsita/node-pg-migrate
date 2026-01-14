import type { PgLiteral, PgLiteralValue } from '../utils';

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

export type Value =
  | null
  | boolean
  | string
  | number
  | PgLiteral
  | PgLiteralValue
  | Value[];

export type Type = string | { type: string };

export type Name = string | { schema?: string; name: string } | PgLiteralValue;

/**
 * Type guard for the object form of {@link Name}.
 *
 * Note: This only checks shape (presence of a "name" property). It intentionally
 * does not validate contents.
 */
export function isNameObject(
  val: unknown
): val is Exclude<Name, string | PgLiteralValue> {
  return typeof val === 'object' && val !== null && 'name' in val;
}

/**
 * Type guard for schema-qualified {@link Name} objects.
 */
export function isSchemaNameObject(
  val: unknown
): val is { schema: string; name: string } {
  return (
    isNameObject(val) &&
    'schema' in val &&
    typeof (val as { schema?: unknown }).schema === 'string'
  );
}

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

/**
 * A function that returns a normal SQL statement or an array of SQL statements.
 *
 * The array is useful for operations that need to return multiple SQL statements like an additional `COMMENT`.
 */
export type OperationFn = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
) => string | string[];

/**
 * A function that returns a normal SQL statement or an array of SQL statements.
 *
 * The array is useful for operations that need to return multiple SQL statements like an additional `COMMENT`.
 *
 * The `reverse` property is a function that takes the same arguments and try to infer the reverse SQL statement with that.
 */
export type Operation = OperationFn & {
  /**
   * Reverse the operation if provided.
   */
  reverse?: OperationFn;
};

/**
 * A function that returns a normal SQL statement or an array of SQL statements.
 *
 * The array is useful for operations that need to return multiple SQL statements like an additional `COMMENT`.
 *
 * The `reverse` property is a function that takes the same arguments and try to infer the reverse SQL statement with that.
 */
export type Reversible<
  TFunction extends (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ) => string | string[],
> = TFunction & {
  /**
   * Reverse the operation.
   *
   * Needs to be the same function definition, because it takes the same
   * arguments and try to infer the reverse SQL statement with that.
   */
  reverse: TFunction;
};
