import type { MigrationOptions } from '../migrationOptions';
import { createTransformer } from '../utils';
import type { Name, Value } from './generalTypes';

export type Sql = (
  sqlStr: string,
  args?: { [key: string]: Name | Value }
) => string;

export function sql(mOptions: MigrationOptions): Sql {
  const t = createTransformer(mOptions.literal);

  return (sqlStr, args) => {
    // applies some very basic templating using the utils.p
    let statement: string = t(sqlStr, args);

    // add trailing ; if not present
    if (statement.lastIndexOf(';') !== statement.length - 1) {
      statement += ';';
    }

    return statement;
  };
}
