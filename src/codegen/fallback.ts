// This module imports nothing, so that `src/baseline/types.ts` can use
// `Fallback` without an import cycle (`src/codegen/types.ts` imports from
// `src/baseline/types.ts`).

/**
 * An object that a generated TypeScript/JavaScript migration creates with raw
 * SQL (`pgm.sql(…)`) because the `pgm` operations cannot express it.
 */
export interface Fallback {
  /**
   * The kind of the object: an `ObjectKind` of the model (e.g. `'table'`),
   * or `'comment'` for a comment that is not set with a table.
   */
  readonly kind: string;

  /**
   * The object, with names as PostgreSQL stores them (no quotes):
   * `schema.name` for objects of a schema, `schema.name(identity
   * arguments)` for functions, operators and aggregates, `name on
   * schema.table` for constraints, triggers, policies and rules, `(source AS
   * target)` for casts; for a comment, the object it is on, with `.column`
   * for a column.
   */
  readonly identity: string;

  /**
   * Why the object needs raw SQL, e.g. `'partition'`: the text of the
   * `// fallback: <reason>` comment above its `pgm.sql(…)` call.
   */
  readonly reason: string;
}
