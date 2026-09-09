import type { MigrationOptions } from '../migrationOptions';
import { isPgLiteral } from '../utils/PgLiteral';
import type { Name, Reversible } from './generalTypes';
import { isNameObject, isSchemaNameObject } from './generalTypes';

type RenameFn = (
  source: Name,
  destination: Name,
  sourceSuffix?: string
) => string;

interface RenameOptions {
  operation: string;
  keyword: string;
  label: string;
}

// A single ordinary or double-quoted PostgreSQL identifier, with optional SQL
// whitespace. Dots and doubled quotes inside a quoted identifier are content.
// Raw SQL expressions, qualifications and U& escape syntax require explicit SQL.
const SINGLE_IDENTIFIER =
  /^[ \t\r\n\f\v]*(?:[A-Za-z_\u0080-\u{10FFFF}][A-Za-z0-9_$\u0080-\u{10FFFF}]*|"(?:[^"]|"")+")[ \t\r\n\f\v]*$/u;

function qualify(schemaSql: string | undefined, nameSql: string): string {
  return schemaSql ? `${schemaSql}.${nameSql}` : nameSql;
}

/** Creates the reversible pair for an object renamed within its schema. */
export function createRenameOperation(
  mOptions: MigrationOptions,
  { operation, keyword, label }: RenameOptions
): Reversible<RenameFn> {
  const nameParts = (value: Name, position: 'source' | 'destination') => {
    if (isPgLiteral(value)) {
      const nameSql = mOptions.literal(value);
      if (nameSql.includes('\0') || !SINGLE_IDENTIFIER.test(nameSql)) {
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

  const rename: RenameFn = (source, destination, sourceSuffix = '') => {
    const { schemaSql, oldNameSql, newNameSql } = resolveNames(
      source,
      destination
    );
    return `ALTER ${keyword} ${qualify(schemaSql, oldNameSql)}${sourceSuffix} RENAME TO ${newNameSql};`;
  };

  const reverse: RenameFn = (source, destination, sourceSuffix = '') => {
    const { schemaSql, oldNameSql, newNameSql } = resolveNames(
      source,
      destination
    );
    return `ALTER ${keyword} ${qualify(schemaSql, newNameSql)}${sourceSuffix} RENAME TO ${oldNameSql};`;
  };

  return Object.assign(rename, { reverse });
}
