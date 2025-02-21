import type { MigrationOptions } from '../../migrationOptions';
import { formatLines } from '../../utils';
import type { Name } from '../generalTypes';

export interface AlterTableOptions {
  levelSecurity: 'DISABLE' | 'ENABLE' | 'FORCE' | 'NO FORCE';
}

export type AlterTable = (
  tableName: Name,
  tableOptions: AlterTableOptions
) => string;

export function alterTable(mOptions: MigrationOptions): AlterTable {
  const _alter: AlterTable = (tableName, options) => {
    const { levelSecurity } = options;

    const alterDefinition: string[] = [];

    if (levelSecurity) {
      alterDefinition.push(`${levelSecurity} ROW LEVEL SECURITY`);
    }

    return `ALTER TABLE ${mOptions.literal(tableName)}
  ${formatLines(alterDefinition)};`;
  };

  return _alter;
}
