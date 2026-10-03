import type { Emitted } from '../types';
import { sqlStatement } from './fallback';

/**
 * The first step (`kind: 'code'`, not a fallback): saves
 * `check_function_bodies` and turns it off for the rest of the transaction,
 * like the SQL output does, so that functions can refer to objects created
 * after them. It runs these two statements, each with `pgm.sql()`:
 *
 * ```sql
 * SELECT pg_catalog.set_config('node_pg_migrate.check_function_bodies', pg_catalog.current_setting('check_function_bodies'), true);
 * SET LOCAL check_function_bodies = false;
 * ```
 */
export function emitPrologue(): Emitted {
  return {
    kind: 'code',
    code: [
      sqlStatement(
        "SELECT pg_catalog.set_config('node_pg_migrate.check_function_bodies', pg_catalog.current_setting('check_function_bodies'), true);"
      ),
      sqlStatement('SET LOCAL check_function_bodies = false;'),
    ].join('\n'),
  };
}

/**
 * The last step (`kind: 'code'`, not a fallback): restores
 * `check_function_bodies`, like the SQL output does, with `pgm.sql()`:
 *
 * ```sql
 * SELECT pg_catalog.set_config('check_function_bodies', pg_catalog.current_setting('node_pg_migrate.check_function_bodies'), true);
 * ```
 */
export function emitEpilogue(): Emitted {
  return {
    kind: 'code',
    code: sqlStatement(
      "SELECT pg_catalog.set_config('check_function_bodies', pg_catalog.current_setting('node_pg_migrate.check_function_bodies'), true);"
    ),
  };
}
