import type { MigrationOptions } from '../../migrationOptions';
import { formatLines } from '../../utils';
import type { Name } from '../generalTypes';

export interface AlterTableOptions {
  levelSecurity?: 'DISABLE' | 'ENABLE' | 'FORCE' | 'NO FORCE';
  setOptions?: { [key: string]: string | boolean };
}

export type AlterTable = (
  tableName: Name,
  tableOptions: AlterTableOptions
) => string;

export function alterTable(mOptions: MigrationOptions): AlterTable {
  const _alter: AlterTable = (tableName, options) => {
    const { levelSecurity, setOptions } = options;

    const alterDefinition: string[] = [];

    if (levelSecurity) {
      alterDefinition.push(`${levelSecurity} ROW LEVEL SECURITY`);
    }

    if (setOptions) {
      if (setOptions.logged === true) {
        alterDefinition.push(`SET LOGGED`);
      } else if (setOptions.logged === false) {
        alterDefinition.push(`SET UNLOGGED`);
      }
    }

    return `ALTER TABLE ${mOptions.literal(tableName)}
  ${formatLines(alterDefinition)};`;
  };

  return _alter;
}
