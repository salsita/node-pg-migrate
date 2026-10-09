// This module imports nothing, so that the Node.js-free entry
// `node-pg-migrate/baseline/catalogs` (`src/baseline/catalogs.ts`) can export
// `DumpSource` without the types of `baseline()`'s Node.js options
// (`src/baseline/types.ts` imports pg's).

/**
 * Where the schema of a baseline came from. Unknown parts are left out.
 */
export interface DumpSource {
  /**
   * The PostgreSQL version of the dumped server, from the dump's
   * `-- Dumped from database version X` comment or the live server.
   */
  readonly serverVersion?: string;

  /**
   * The version of pg_dump, from the dump's `-- Dumped by pg_dump version Y`
   * comment or `pg_dump --version`.
   */
  readonly pgDumpVersion?: string;

  /**
   * The base name of the `fromFile` dump, or `'stdin'` when it was read from
   * standard input.
   */
  readonly file?: string;
}
