import { readFile } from 'node:fs/promises';
import type { MigrationAction } from './migration';
import type { ColumnDefinitions } from './operations/tables';

function createMigrationCommentRegex(direction: 'up' | 'down'): RegExp {
  return new RegExp(`^\\s*--[\\s-]*${direction}\\s+migration`, 'im');
}

export function hasNoTransactionDirective(content: string): boolean {
  let lineStart = 0;
  while (lineStart < content.length) {
    const newline = content.indexOf('\n', lineStart);
    const lineEnd = newline < 0 ? content.length : newline;
    const headerLine = content.slice(lineStart, lineEnd).trim();
    lineStart = lineEnd + 1;
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

/**
 * Queue SQL, disabling its transaction first when the caller found a header
 * directive. Omit only a leading UTF-8 encoding marker from the queued SQL.
 */
export function createSqlMigrationAction(
  sql: string,
  noTransaction: boolean
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
  const upMigrationCommentRegex = createMigrationCommentRegex('up');
  const downMigrationCommentRegex = createMigrationCommentRegex('down');

  const upMigrationStart = content.search(upMigrationCommentRegex);
  const downMigrationStart = content.search(downMigrationCommentRegex);
  const headerEnd = Math.min(
    upMigrationStart < 0 ? content.length : upMigrationStart,
    downMigrationStart < 0 ? content.length : downMigrationStart
  );
  const noTransaction = hasNoTransactionDirective(content.slice(0, headerEnd));

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
