import { describe, expect, it, vi } from 'vitest';
import { MigrationBuilder } from '../src';

describe('migrationBuilder', () => {
  it.each([
    ['renameType', 'TYPE'],
    ['renameDomain', 'DOMAIN'],
    ['renameView', 'VIEW'],
    ['renameMaterializedView', 'MATERIALIZED VIEW'],
    ['renameSequence', 'SEQUENCE'],
    ['renameIndex', 'INDEX'],
  ] as const)(
    'should reverse a qualified %s chain in reverse order',
    (operation, keyword) => {
      const db = { query: vi.fn(), select: vi.fn() };
      for (const reverse of [false, true]) {
        const pgm = new MigrationBuilder(db, undefined, false, console);
        if (reverse) {
          pgm.enableReverseMode();
        }
        pgm[operation]({ schema: 'app', name: 'old' }, 'middle');
        pgm[operation](
          { schema: 'app', name: 'middle' },
          { schema: 'app', name: 'new' }
        );
        expect(pgm.getSqlSteps()).toEqual(
          reverse
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
      expect(db.query).not.toHaveBeenCalled();
      expect(db.select).not.toHaveBeenCalled();
    }
  );

  it('should expose MigrationBuilder to allow using as sql builder', () => {
    const pgm = new MigrationBuilder(
      {
        query: vi.fn(),
        select: vi.fn(),
      },
      undefined,
      true,
      console,
      false
    );

    pgm.createTable('users', {
      id: 'id',
      name: { type: 'varchar(1000)', notNull: true },
      createdAt: {
        type: 'timestamp',
        notNull: true,
        default: pgm.func('current_timestamp'),
      },
    });
    pgm.createTable('posts', {
      id: 'id',
      userId: {
        type: 'integer',
        notNull: true,
        references: '"users"',
        onDelete: 'CASCADE',
      },
      body: { type: 'text', notNull: true },
      createdAt: {
        type: 'timestamp',
        notNull: true,
        default: pgm.func('current_timestamp'),
      },
    });
    pgm.createIndex('posts', 'userId');

    expect(pgm.getSql()).toMatchSnapshot();
  });

  it('should format the generated SQL across multiple lines when pretty is enabled', () => {
    const pgm = new MigrationBuilder(
      {
        query: vi.fn(),
        select: vi.fn(),
      },
      undefined,
      true,
      console,
      true
    );

    pgm.createTable('users', {
      id: 'id',
      name: { type: 'varchar(1000)', notNull: true },
    });

    expect(pgm.getSql()).toBe(
      `CREATE TABLE "users" (
  "id" serial PRIMARY KEY,
  "name" varchar(1000) NOT NULL
);
`
    );
  });
});
