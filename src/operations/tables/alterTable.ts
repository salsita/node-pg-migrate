import type { MigrationOptions } from '../../types';
import { formatLines } from '../../utils';
import type { Name } from '../generalTypes';

export interface AlterTableOptions {
  levelSecurity: 'DISABLE' | 'ENABLE' | 'FORCE' | 'NO FORCE';
}

export type AlterTable = (
  tableName: Name,
  alterOptions: AlterTableOptions
) => string;

export function alterTable(mOptions: MigrationOptions): AlterTable {
  const _alter: AlterTable = (tableName, options) => {
    const alterDefinition: string[] = [];

    if (options.levelSecurity) {
      alterDefinition.push(`${options.levelSecurity} ROW LEVEL SECURITY`);
    }

    return `ALTER TABLE ${mOptions.literal(tableName)}
  ${formatLines(alterDefinition)};`;
  };

  return _alter;
}
