import { describe, expect, it, vi } from 'vitest';
import type {
  GrantOnTablesOptions,
  IndexStorageParameters,
  Reference,
} from '../src';
import { MigrationBuilder } from '../src';

describe('migrationBuilder', () => {
  it.each([false, true])(
    'queues explicit references and automatically reverses them (reverse: %s)',
    (reverse) => {
      const pgm = new MigrationBuilder(
        { query: vi.fn(), select: vi.fn() },
        undefined,
        false,
        console,
        false
      );
      const references: Reference = {
        schema: 'app',
        name: 'parents',
        columns: 'code',
      };
      if (reverse) {
        pgm.enableReverseMode();
      }
      pgm.createTable('children', { id: 'integer' });
      pgm.addColumns('children', { code: { type: 'text', references } });
      pgm.createConstraint('children', 'code_fk', {
        foreignKeys: { columns: 'code', references },
      });
      expect(pgm.getSql()).toBe(
        reverse
          ? 'ALTER TABLE "children" DROP CONSTRAINT "code_fk";\nALTER TABLE "children" DROP "code";\nDROP TABLE "children";\n'
          : 'CREATE TABLE "children" ("id" integer);\nALTER TABLE "children" ADD "code" text REFERENCES "app"."parents" ("code");\nALTER TABLE "children" ADD CONSTRAINT "code_fk" FOREIGN KEY ("code") REFERENCES "app"."parents" ("code");\n'
      );
    }
  );

  it.each([
    ['grantOnTables', 'GRANT SELECT ON "foo" TO "reader";\n'],
    ['revokeOnTables', 'REVOKE SELECT ON "foo" FROM "reader";\n'],
  ] as const)(
    'preserves named tables through %s with an extra schema',
    (operation, expectedSql) => {
      const pgm = new MigrationBuilder(
        { query: vi.fn(), select: vi.fn() },
        undefined,
        false,
        console,
        false
      );
      const options: GrantOnTablesOptions & { schema: string } = {
        tables: 'foo',
        schema: 'app',
        roles: 'reader',
        privileges: 'SELECT',
      };

      pgm[operation](options);

      expect(pgm.getSql()).toBe(expectedSql);
    }
  );

  it('preserves named tables when automatically reversing a grant with an extra schema', () => {
    const pgm = new MigrationBuilder(
      { query: vi.fn(), select: vi.fn() },
      undefined,
      false,
      console,
      false
    );
    const options: GrantOnTablesOptions & { schema: string } = {
      tables: { schema: 'app', name: 'foo' },
      schema: 'other_schema',
      roles: 'reader',
      privileges: 'SELECT',
      withGrantOption: true,
      onlyGrantOption: true,
      cascade: true,
    };
    pgm.enableReverseMode();

    pgm.grantOnTables(options);

    expect(pgm.getSql()).toBe(
      'REVOKE GRANT OPTION FOR SELECT ON "app"."foo" FROM "reader" CASCADE;\n'
    );
  });

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
