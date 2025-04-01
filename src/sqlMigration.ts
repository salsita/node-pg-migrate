import { readFile } from 'node:fs/promises';
import type { MigrationAction } from './migration';
import type { ColumnDefinitions } from './operations/tables';

function createMigrationCommentRegex(direction: 'up' | 'down'): RegExp {
  return new RegExp(`^\\s*--[\\s-]*${direction}\\s+migration`, 'im');
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
    up: (pgm) => {
      pgm.sql(upSql);
    },

    down:
      downSql === undefined
        ? false
        : (pgm) => {
            pgm.sql(downSql);
          },
  };
}

export async function sqlMigration(
  sqlPath: string
): Promise<MigrationBuilderActions> {
  const content = await readFile(sqlPath, 'utf8');

  return getActions(content);
}
