import type { OrderedObject, Phase, SchemaModel } from '../types';

/**
 * The phase of each kind of step. Among the steps whose dependencies are
 * met, a lower phase goes first.
 */
export const PHASES = {
  /**
   * Saves `check_function_bodies` and turns it off.
   */
  prologue: 0,
  schemas: 1,
  extensions: 2,

  /**
   * Enums, composite types, domains and range types.
   */
  types: 3,

  /**
   * Collations, with the types.
   */
  collations: 3,
  sequences: 4,
  functions: 5,

  /**
   * Operators, after the functions that implement them.
   */
  operators: 6,

  /**
   * Casts, after the functions that implement them.
   */
  casts: 7,
  aggregates: 8,

  /**
   * Tables; a partition or inheritance child after its parents.
   */
  tables: 9,
  sequenceOwnership: 10,

  /**
   * Primary key, unique, exclusion and CHECK constraints.
   */
  constraints: 11,
  foreignKeys: 12,
  indexes: 13,

  /**
   * Views and materialized views.
   */
  views: 14,
  triggers: 15,

  /**
   * Row-level security and policies.
   */
  rowLevelSecurity: 16,

  /**
   * Rules and extended statistics.
   */
  rulesAndStatistics: 17,
  comments: 18,

  /**
   * Restores `check_function_bodies`.
   */
  epilogue: 99,
} as const satisfies Readonly<Record<string, Phase>>;

/**
 * Puts the steps of a migration in an order that PostgreSQL accepts: a
 * topological sort over every step using `model.dependencies`, where among
 * the steps whose dependencies are met the first one goes first by, in
 * turn:
 *
 * 1. `phase` (see {@link PHASES});
 * 2. `schema`, then `name` of the object (of the sequence, table or
 *    commented object for the `sequenceOwnership`, `rowLevelSecurity` and
 *    `comment` steps); a cast has neither, so casts are compared by
 *    `source`, then `target`;
 * 3. the schema, then the name of the object's table, for objects of a table;
 * 4. `identityArguments`, for functions, operators and aggregates;
 * 5. the column or constraint of a comment (`''` for a comment on the object
 *    itself);
 * 6. the step (`create`, `sequenceOwnership`, `rowLevelSecurity`, `comment`),
 *    then the object's `kind`, then its `oid`.
 *
 * Strings are compared by UTF-16 code units (`<`), not by locale.
 *
 * The steps are: the `prologue` (first) and the `epilogue` (last); a
 * `create` step per object of the model; a `sequenceOwnership` step per
 * sequence with `ownedBy`, after the sequence and the owning table; a
 * `rowLevelSecurity` step per table with row-level security enabled or
 * forced, after the table; and a `comment` step, after the object it is on,
 * per comment that is not set with a table: comments on objects other than
 * tables and extensions, on the columns of views, materialized views and
 * composite types, on domain constraints, and on the indexes of
 * constraints. Comments on tables and on their columns are set with the
 * table.
 *
 * Throws a `BaselineError` with code `UNSUPPORTED_OBJECTS` naming the
 * objects of a dependency cycle, when there is one.
 *
 * @param model The schema.
 * @returns The steps, in order.
 */
export function orderObjects(
  _model: SchemaModel
): ReadonlyArray<OrderedObject> {
  throw new Error('not implemented');
}
