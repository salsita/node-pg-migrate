import type { BaselineOptions, BaselineResult } from './types';

export { BaselineError } from './errors';
export type { BaselineErrorCode } from './errors';
export type { BaselineOptions, BaselineResult, DumpSource } from './types';

/**
 * Writes a baseline migration: one SQL migration that creates the schema of
 * an existing database, so that node-pg-migrate can manage a database it did
 * not create.
 *
 * The schema comes from `pg_dump --schema-only`, which either runs against
 * the database or was run before (`fromFile`), and is cleaned up to run
 * inside node-pg-migrate's migration transaction. Databases that already have
 * the schema record the migration without running it (see
 * `BaselineResult.fakeCommand`); blank databases run it like any other
 * migration.
 *
 * Throws a `BaselineError` when the options, the database or the dump are not
 * suitable for a baseline; its message says why and what to do.
 *
 * @param options Where the schema comes from and where the migration goes.
 * @returns The written migration, and what the user should know about it.
 */
export function baseline(_options: BaselineOptions): Promise<BaselineResult> {
  return Promise.reject(new Error('not implemented'));
}
