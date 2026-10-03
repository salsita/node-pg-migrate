import type { QualifiedName } from '../baseline/types';
import type { Code } from './code';
import { object, str } from './code';
import type { EmitContext } from './types';

/**
 * A `Name` argument of a `pgm` operation as a value of the generated code
 * (see {@link renderName}).
 *
 * @param name The name, as PostgreSQL stores it.
 * @param ctx The migration's default schema.
 */
export function nameCode(name: QualifiedName, ctx: EmitContext): Code {
  return name.schema === undefined || name.schema === ctx.defaultSchema
    ? str(name.name)
    : object([
        ['schema', str(name.schema)],
        ['name', str(name.name)],
      ]);
}

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
export function renderName(name: QualifiedName, ctx: EmitContext): string {
  return nameCode(name, ctx).text;
}
