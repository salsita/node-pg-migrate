import type { Table } from '../../introspect/types';
import { object, statement, str } from '../code';
import { nameCode } from '../names';
import type { EmitContext, Emitted } from '../types';

/**
 * `pgm.alterTable(table, { levelSecurity: 'ENABLE' })` when row-level
 * security is enabled, then `pgm.alterTable(table, { levelSecurity: 'FORCE'
 * })` when it is forced. Never a fallback.
 *
 * @param table A table with row-level security enabled or forced.
 * @param ctx The migration context.
 */
export function emitRowLevelSecurity(table: Table, ctx: EmitContext): Emitted {
  const levels = [
    ...(table.rowLevelSecurity ? ['ENABLE'] : []),
    ...(table.forceRowLevelSecurity ? ['FORCE'] : []),
  ];

  return {
    kind: 'code',
    code: levels
      .map((level) =>
        statement('alterTable', [
          nameCode(table, ctx),
          object([['levelSecurity', str(level)]]),
        ])
      )
      .join('\n'),
  };
}
