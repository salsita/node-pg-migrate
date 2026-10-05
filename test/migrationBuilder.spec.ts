import { describe, expect, it, vi } from 'vitest';
import type { IndexStorageParameters } from '../src';
import { MigrationBuilder } from '../src';

describe('migrationBuilder', () => {
  it.each([
    [
      'grantOnSequences',
      'GRANT SELECT, USAGE ON SEQUENCE "app"."ids" TO "reader";\n',
    ],
    [
      'revokeOnSequences',
      'REVOKE SELECT, USAGE ON SEQUENCE "app"."ids" FROM "reader";\n',
    ],
  ] as const)('exposes %s', (operation, expectedSql) => {
    const pgm = new MigrationBuilder(
      { query: vi.fn(), select: vi.fn() },
      undefined,
      false,
      console,
      false
    );

    pgm[operation]({
      sequences: { schema: 'app', name: 'ids' },
      roles: 'reader',
      privileges: ['SELECT', 'USAGE'],
    });

    expect(pgm.getSql()).toBe(expectedSql);
  });

  it('automatically reverses sequence grants', () => {
    const pgm = new MigrationBuilder(
      { query: vi.fn(), select: vi.fn() },
      undefined,
      false,
      console,
      false
    );
    pgm.enableReverseMode();

    pgm.grantOnSequences({
      sequences: 'ALL',
      schema: 'app',
      roles: 'reader',
      privileges: 'ALL',
      cascade: true,
    });

    expect(pgm.getSql()).toBe(
      'REVOKE ALL ON ALL SEQUENCES IN SCHEMA "app" FROM "reader" CASCADE;\n'
    );
  });

  it.each(['createIndex', 'addIndex'] as const)(
    'exposes storage parameters through %s',
    (operation) => {
      const pgm = new MigrationBuilder(
        { query: vi.fn(), select: vi.fn() },
        undefined,
        false,
        console,
        false
      );

      const storageParameters: IndexStorageParameters = {
        fillfactor: 70,
        deduplicate_items: false,
      };

      pgm[operation]('films', 'title', { storageParameters });

      expect(pgm.getSql()).toBe(
        'CREATE INDEX "films_title_index" ON "films" ("title") WITH ("fillfactor" = 70, "deduplicate_items" = false);\n'
      );
    }
  );

  it.each(['createIndex', 'addIndex'] as const)(
    'exposes the BRIN method through %s',
    (operation) => {
      const pgm = new MigrationBuilder(
        { query: vi.fn(), select: vi.fn() },
        undefined,
        false,
        console,
        false
      );

      pgm[operation]('events', 'created_at', {
        method: 'brin',
        storageParameters: { pages_per_range: 32, autosummarize: true },
      });

      expect(pgm.getSql()).toContain('USING brin');
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
