import type { MigrationOptions } from '../migrationOptions';
import { isSingleIdentifier } from '../utils/isSingleIdentifier';
import { isPgLiteral } from '../utils/PgLiteral';
import type { Name, Reversible } from './generalTypes';
import { isNameObject, isSchemaNameObject } from './generalTypes';

type RenameFn = (source: Name, destination: Name) => string;

interface RenameOptions {
  operation: string;
  keyword: string;
  label: string;
  sourceSuffix?: string;
}

function qualify(schemaSql: string | undefined, nameSql: string): string {
  return schemaSql ? `${schemaSql}.${nameSql}` : nameSql;
}

/** Creates the reversible pair for an object renamed within its schema. */
export function createRenameOperation(
  mOptions: MigrationOptions,
  { operation, keyword, label, sourceSuffix = '' }: RenameOptions
): Reversible<RenameFn> {
  const nameParts = (value: Name, position: 'source' | 'destination') => {
    if (isPgLiteral(value)) {
      const nameSql = mOptions.literal(value);
      if (!isSingleIdentifier(nameSql)) {
        throw new Error(
          `${operation} requires a single unqualified identifier for a PgLiteral ${position}; use { schema, name } for schema-qualified names`
        );
      }
      return { schemaSql: undefined, nameSql };
    }

    const schema = isSchemaNameObject(value)
      ? value.schema || undefined
      : undefined;
    return {
      schemaSql: schema ? mOptions.literal(schema) : undefined,
      nameSql: mOptions.literal(isNameObject(value) ? value.name : value),
    };
  };

  const resolveNames = (source: Name, destination: Name) => {
    const oldName = nameParts(source, 'source');
    const newName = nameParts(destination, 'destination');
    if (newName.schemaSql && !oldName.schemaSql) {
      throw new Error(
        `${operation} cannot infer the source schema; use { schema, name } for the source`
      );
    }
    if (newName.schemaSql && newName.schemaSql !== oldName.schemaSql) {
      throw new Error(`${operation} cannot change the schema of ${label}`);
    }
    return {
      schemaSql: oldName.schemaSql,
      oldNameSql: oldName.nameSql,
      newNameSql: newName.nameSql,
    };
  };

  const rename: RenameFn = (source, destination) => {
    const { schemaSql, oldNameSql, newNameSql } = resolveNames(
      source,
      destination
    );
    return `ALTER ${keyword} ${qualify(schemaSql, oldNameSql)}${sourceSuffix} RENAME TO ${newNameSql};`;
  };

  const reverse: RenameFn = (source, destination) => {
    const { schemaSql, oldNameSql, newNameSql } = resolveNames(
      source,
      destination
    );
    return `ALTER ${keyword} ${qualify(schemaSql, newNameSql)}${sourceSuffix} RENAME TO ${oldNameSql};`;
  };

  return Object.assign(rename, { reverse });
}
