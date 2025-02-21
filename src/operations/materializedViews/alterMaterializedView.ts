import type { MigrationOptions } from '../../migrationOptions';
import { formatLines } from '../../utils';
import type { Name, Nullable } from '../generalTypes';
import type { StorageParameters } from './shared';
import { storageParameterStr } from './shared';

export interface AlterMaterializedViewOptions {
  cluster?: null | false | string;

  extension?: string;

  storageParameters?: Nullable<StorageParameters>;
}

export type AlterMaterializedView = (
  viewName: Name,
  materializedViewOptions: AlterMaterializedViewOptions
) => string;

export function alterMaterializedView(
  mOptions: MigrationOptions
): AlterMaterializedView {
  const _alter: AlterMaterializedView = (viewName, options) => {
    const { cluster, extension, storageParameters = {} } = options;

    const clauses: string[] = [];

    if (cluster !== undefined) {
      if (cluster) {
        clauses.push(`CLUSTER ON ${mOptions.literal(cluster)}`);
      } else {
        clauses.push('SET WITHOUT CLUSTER');
      }
    }

    if (extension) {
      clauses.push(`DEPENDS ON EXTENSION ${mOptions.literal(extension)}`);
    }

    const withOptions = Object.keys(storageParameters)
      .filter((key) => storageParameters[key] !== null)
      .map(storageParameterStr(storageParameters))
      .join(', ');

    if (withOptions) {
      clauses.push(`SET (${withOptions})`);
    }

    const resetOptions = Object.keys(storageParameters)
      .filter((key) => storageParameters[key] === null)
      .join(', ');

    if (resetOptions) {
      clauses.push(`RESET (${resetOptions})`);
    }

    const clausesStr = formatLines(clauses);
    const viewNameStr = mOptions.literal(viewName);

    return `ALTER MATERIALIZED VIEW ${viewNameStr}\n${clausesStr};`;
  };

  return _alter;
}
