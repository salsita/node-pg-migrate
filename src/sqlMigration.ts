import { readFile } from 'node:fs/promises';
import type { MigrationBuilderActions } from './types';

function createMigrationCommentRegex(direction: 'up' | 'down'): RegExp {
  return new RegExp(`^\\s*--[\\s-]*${direction}\\s+migration`, 'im');
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

async function sqlMigration(sqlPath: string): Promise<MigrationBuilderActions> {
  const content = await readFile(sqlPath, 'utf8');

  return getActions(content);
}

export default sqlMigration;
