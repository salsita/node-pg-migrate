import type { MigrationOptions } from '../../migrationOptions';
import { formatLines } from '../../utils';
import type { Name } from '../generalTypes';

export interface AlterTableOptions {
  levelSecurity?: 'DISABLE' | 'ENABLE' | 'FORCE' | 'NO FORCE';
  unlogged?: boolean;
}

export type AlterTable = (
  tableName: Name,
  tableOptions: AlterTableOptions
) => string;

export function alterTable(mOptions: MigrationOptions): AlterTable {
  const _alter: AlterTable = (tableName, options) => {
    const { levelSecurity, unlogged } = options;

    const alterDefinition: string[] = [];

    if (levelSecurity) {
      alterDefinition.push(`${levelSecurity} ROW LEVEL SECURITY`);
    }

    if (unlogged === true) {
      alterDefinition.push(`SET UNLOGGED`);
    } else if (unlogged === false) {
      alterDefinition.push(`SET LOGGED`);
    }

    if (alterDefinition.length === 0) {
      throw new Error('No table options provided for alterTable');
    }

    const alterDefinitionStr = formatLines(
      alterDefinition,
      '  ',
      ',',
      mOptions.pretty
    );

    return `ALTER TABLE ${mOptions.literal(tableName)}${mOptions.pretty ? `\n  ${alterDefinitionStr}` : ` ${alterDefinitionStr}`};`;
  };

  return _alter;
}
