import type { QualifiedName } from '../baseline/types';
import type { EmitContext } from './types';

/**
 * Writes the code of a `Name` argument of a `pgm` operation: the name alone
 * (`'users'`) when it has no schema or its schema is the migration's default
 * schema, else an object (`{ schema: 'app', name: 'users' }`). Strings are
 * written with `tsString()`.
 *
 * @param name The name, as PostgreSQL stores it.
 * @param ctx The migration's default schema.
 * @returns The code of the name.
 */
export function renderName(_name: QualifiedName, _ctx: EmitContext): string {
  throw new Error('not implemented');
}
