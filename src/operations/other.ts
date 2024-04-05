import type { MigrationOptions } from '../types';
import { createTransformer } from '../utils';
import type { Sql } from './othersTypes';

export type { Sql };

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
