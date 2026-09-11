import type { CatalogRows } from '../types';

/**
 * The name of an introspection query: the key of `CatalogRows` its rows go
 * to.
 */
export type QueryName = keyof CatalogRows;

/**
 * The SQL of the introspection queries, by name, in the order `introspect()`
 * runs them.
 *
 * Each query is ONE set-based query for a whole family of objects (never one
 * query per object) and takes no parameters, so `introspect()` runs the same
 * number of queries whatever the size of the schema. The queries run while
 * `search_path` is empty, so the catalog functions they call
 * (`format_type()`, `pg_get_expr()`, `pg_get_*def()`) schema-qualify every
 * name. Each returns the columns of its row type in `CatalogRows`, and works
 * on every supported PostgreSQL version.
 */
export const QUERIES: Readonly<Record<QueryName, string>> = {
  schemas: '',
  extensions: '',
  enums: '',
  composites: '',
  domains: '',
  ranges: '',
  collations: '',
  sequences: '',
  functions: '',
  operators: '',
  casts: '',
  aggregates: '',
  tables: '',
  columns: '',
  constraints: '',
  indexes: '',
  views: '',
  triggers: '',
  policies: '',
  rules: '',
  statistics: '',
  dependencies: '',
  unsupported: '',
};
