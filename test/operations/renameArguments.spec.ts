import { describe, expect, it, vi } from 'vitest';
import { MigrationBuilder } from '../../src';
import { renameDomain } from '../../src/operations/domains';
import { renameIndex } from '../../src/operations/indexes';
import { renameMaterializedView } from '../../src/operations/materializedViews';
import { renameSequence } from '../../src/operations/sequences';
import { renameTable } from '../../src/operations/tables';
import { renameType } from '../../src/operations/types';
import { renameView } from '../../src/operations/views';
import { options1 } from '../presetMigrationOptions';

const operations = [
  { operation: 'renameTable', keyword: 'TABLE', create: renameTable },
  { operation: 'renameType', keyword: 'TYPE', create: renameType },
  { operation: 'renameDomain', keyword: 'DOMAIN', create: renameDomain },
  { operation: 'renameView', keyword: 'VIEW', create: renameView },
  {
    operation: 'renameMaterializedView',
    keyword: 'MATERIALIZED VIEW',
    create: renameMaterializedView,
  },
  { operation: 'renameSequence', keyword: 'SEQUENCE', create: renameSequence },
  { operation: 'renameIndex', keyword: 'INDEX', create: renameIndex },
] as const;

const extraArguments = [
  { title: 'undefined', value: undefined },
  { title: 'null', value: null },
  { title: 'SQL fragment', value: ' CASCADE; DROP TABLE users; --' },
  { title: 'number', value: 0 },
  { title: 'object', value: { some: 'object' } },
  { title: 'symbol', value: Symbol('extra') },
  { title: 'array', value: ['extra'] },
  {
    title: 'object that must not be coerced',
    value: {
      [Symbol.toPrimitive]() {
        throw new Error('Unexpected coercion of an ignored argument');
      },
    },
  },
];

describe.each(operations)(
  '$operation runtime arguments',
  ({ operation, keyword, create }) => {
    describe.each(['up', 'down'] as const)('%s', (direction) => {
      const source = { schema: 'app', name: 'old' };
      const destination = { schema: 'app', name: 'new' };
      const expected =
        direction === 'down'
          ? `ALTER ${keyword} "app"."new" RENAME TO "old";`
          : `ALTER ${keyword} "app"."old" RENAME TO "new";`;

      it.each(extraArguments)('ignores $title in direct calls', ({ value }) => {
        const rename = create(options1);
        const fn = direction === 'down' ? rename.reverse : rename;
        expect(
          Reflect.apply(fn, undefined, [source, destination, value, 'extra'])
        ).toBe(expected);
      });

      it.each(extraArguments)(
        'ignores $title through MigrationBuilder',
        ({ value }) => {
          const pgm = new MigrationBuilder(
            { query: vi.fn(), select: vi.fn() },
            undefined,
            false,
            console
          );
          if (direction === 'down') {
            pgm.enableReverseMode();
          }
          Reflect.apply(pgm[operation], pgm, [
            source,
            destination,
            value,
            'extra',
          ]);
          expect(pgm.getSqlSteps()).toEqual([expected]);
        }
      );
    });
  }
);
