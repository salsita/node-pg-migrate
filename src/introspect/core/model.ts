import type { CatalogRows, IntrospectOptions, SchemaModel } from '../types';

/**
 * The comment of the `public` schema in a new database. `rowsToModel()`
 * only keeps `public` when its comment is something else.
 */
export const DEFAULT_PUBLIC_SCHEMA_COMMENT = 'standard public schema';

/**
 * The bits of `pg_trigger.tgtype` (`TRIGGER_TYPE_*` in PostgreSQL's
 * `pg_trigger.h`). A trigger that is neither `BEFORE` nor `INSTEAD` fires
 * `AFTER`; one without `ROW` fires `FOR EACH STATEMENT`.
 */
export const TRIGGER_TYPE = {
  ROW: 1,
  BEFORE: 2,
  INSERT: 4,
  DELETE: 8,
  UPDATE: 16,
  TRUNCATE: 32,
  INSTEAD: 64,
} as const;

/**
 * Builds the model of a schema from the rows of the introspection queries.
 *
 * - Scope: rows whose `schema` is not in `includeSchemas` (when set) or is in
 *   `excludeSchemas` are left out, with everything that belongs to their
 *   objects; extensions are kept whatever their schema, and so are
 *   unsupported objects without a schema. Casts, which have no schema, are
 *   kept unless `includeSchemas` is set (like `pg_dump --schema`).
 * - The migrations table (`migrationsSchema`.`migrationsTable`) is left out
 *   with its columns, constraints, indexes, triggers, policies, rules and
 *   statistics, and so are the sequences its columns own and
 *   `migrationsSequence` (default `<migrationsTable>_id_seq` in
 *   `migrationsSchema`). Names are compared exactly.
 * - `public` is only kept when its comment is neither null nor
 *   {@link DEFAULT_PUBLIC_SCHEMA_COMMENT}.
 * - Catalog codes become the model's values (see each type): `tgtype` bits
 *   (see {@link TRIGGER_TYPE}) become `timing`, `events` and `level`;
 *   `attstorage` is only kept when it differs from `typstorage`; `-1`/null
 *   statistics targets, `''` codes, a `heap` access method and null texts
 *   are left out.
 * - Columns go to their table, view, materialized view or composite type
 *   (by `relid`), in `attnum` order. The `default` of a generated column is
 *   its `generated.expression`. A column gets `ownedSequence` when exactly one
 *   kept sequence is owned by it.
 * - Table constraints that are not local (`conislocal`) are left out. `NOT
 *   NULL` rows (`contype = 'n'`) are folded into their column (`conkey`) as
 *   `notNullConstraint`, or into their domain as `notNullConstraintName`;
 *   the CHECK rows of a domain become its `checks`.
 * - The arguments of a routine come from `argTypes`, `argNames` (`''` is no
 *   name), `argModes` and `argDefaults`, without `TABLE` (`t`) columns;
 *   `proconfig` entries are split at their first `=`.
 * - The arguments of a trigger are the zero-terminated parts of `tgargs`,
 *   decoded as UTF-8; its `condition` is taken from `definition` when
 *   `hasCondition`.
 * - A view's `definition` loses its final `;`, and the `check_option` entry
 *   of its `reloptions` becomes `checkOption`.
 * - A partition's parent is its one `inherits` row (`partitionOf.parent`),
 *   so its `inherits` is empty.
 * - `dependencies` are the rows of the `dependencies` query between objects
 *   of the model, as `ObjectRef`s, plus the implicit ones (see
 *   `SchemaModel.dependencies`).
 * - Every array is sorted as the model's conventions say (see
 *   `SchemaModel`), so the same rows in any order give the same model.
 *
 * @param rows The rows of every introspection query.
 * @param facts Which schemas are in scope, and where the migrations table is.
 * @returns The model.
 */
export function rowsToModel(
  _rows: CatalogRows,
  _facts: IntrospectOptions
): SchemaModel {
  throw new Error('not implemented');
}
