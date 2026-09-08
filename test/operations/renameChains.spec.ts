import { describe, expect, it, vi } from 'vitest';
import { MigrationBuilder } from '../../src';

describe('schema-qualified rename chains', () => {
  const operations = [
    ['renameType', 'TYPE'],
    ['renameDomain', 'DOMAIN'],
    ['renameView', 'VIEW'],
    ['renameMaterializedView', 'MATERIALIZED VIEW'],
    ['renameSequence', 'SEQUENCE'],
    ['renameIndex', 'INDEX'],
  ] as const;
  const cases = operations.flatMap(([operation, keyword]) =>
    (['up', 'down'] as const).map((direction) => ({
      operation,
      keyword,
      direction,
    }))
  );

  it.each(cases)(
    'should preserve schema and rename order for $operation ($direction)',
    ({ operation, keyword, direction }) => {
      const db = { query: vi.fn(), select: vi.fn() };
      const pgm = new MigrationBuilder(db, undefined, false, console);
      if (direction === 'down') {
        pgm.enableReverseMode();
      }
      pgm[operation]({ schema: 'app', name: 'old' }, 'middle');
      pgm[operation](
        { schema: 'app', name: 'middle' },
        { schema: 'app', name: 'new' }
      );

      expect(pgm.getSqlSteps()).toEqual(
        direction === 'down'
          ? [
              `ALTER ${keyword} "app"."new" RENAME TO "middle";`,
              `ALTER ${keyword} "app"."middle" RENAME TO "old";`,
            ]
          : [
              `ALTER ${keyword} "app"."old" RENAME TO "middle";`,
              `ALTER ${keyword} "app"."middle" RENAME TO "new";`,
            ]
      );
    }
  );
});
