import { readFile } from 'node:fs/promises';
import type { MigrationAction } from './migration';
import type { ColumnDefinitions } from './operations/tables';

function createMigrationCommentRegex(direction: 'up' | 'down'): RegExp {
  return new RegExp(`^\\s*--[\\s-]*${direction}\\s+migration`, 'im');
}

function hasNoTransactionDirective(content: string): boolean {
  for (const line of content.split(/\r?\n/)) {
    const headerLine = line.trim();
    if (!headerLine) {
      continue;
    }
    if (!headerLine.startsWith('--')) {
      return false;
    }
    if (/^--[ \t]*no[ \t]*transaction[ \t]*$/i.test(headerLine)) {
      return true;
    }
  }
  return false;
}

/** Create an action, omitting only a leading UTF-8 encoding marker. */
export function createSqlMigrationAction(
  sql: string,
  noTransaction = hasNoTransactionDirective(sql)
): MigrationAction {
  const sqlContent = sql.startsWith('\uFEFF') ? sql.slice(1) : sql;
  return (pgm) => {
    if (noTransaction) {
      pgm.noTransaction();
    }
    pgm.sql(sqlContent);
  };
}

export interface MigrationBuilderActions {
  up?: MigrationAction | false;

  down?: MigrationAction | false;

  shorthands?: ColumnDefinitions;
}

export function getActions(content: string): MigrationBuilderActions {
  const noTransaction = hasNoTransactionDirective(content);
  const upMigrationCommentRegex = createMigrationCommentRegex('up');
  const downMigrationCommentRegex = createMigrationCommentRegex('down');

  const upMigrationStart = content.search(upMigrationCommentRegex);
  const downMigrationStart = content.search(downMigrationCommentRegex);

  const upSql =
    upMigrationStart >= 0
      ? content.slice(
          upMigrationStart,
          downMigrationStart < upMigrationStart ? undefined : downMigrationStart
        )
      : content;

  const downSql =
    downMigrationStart >= 0
      ? content.slice(
          downMigrationStart,
          upMigrationStart < downMigrationStart ? undefined : upMigrationStart
        )
      : undefined;

  return {
    up: createSqlMigrationAction(upSql, noTransaction),

    down:
      downSql === undefined
        ? false
        : createSqlMigrationAction(downSql, noTransaction),
  };
}

export async function sqlMigration(
  sqlPath: string
): Promise<MigrationBuilderActions> {
  const content = await readFile(sqlPath, 'utf8');

  return getActions(content);
}
