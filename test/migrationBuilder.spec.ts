import { describe, expect, it, vi } from 'vitest';
import type {
  GrantOnTablesOptions,
  IndexStorageParameters,
  Reference,
} from '../src';
import { MigrationBuilder } from '../src';

describe('migrationBuilder', () => {
  it('queues a multi-row insert as one step and ignores an empty array', () => {
    const db = { query: vi.fn(), select: vi.fn() };
    const pgm = new MigrationBuilder(db, undefined, false, console);
    pgm.insert('names', [{ name: 'Ada' }, { name: 'Grace' }]);
    pgm.insert('names', []);
    expect(pgm.getSqlSteps()).toEqual([
      'INSERT INTO "names" ("name") VALUES ($pga$Ada$pga$), ($pga$Grace$pga$);',
    ]);
    expect(db.query).not.toHaveBeenCalled();
    expect(db.select).not.toHaveBeenCalled();
  });

  it('does not queue earlier rows when a later record is invalid', () => {
    const pgm = new MigrationBuilder(
      { query: vi.fn(), select: vi.fn() },
      undefined,
      false,
      console
    );
    pgm.sql('SELECT 1');
    expect(() => {
      pgm.insert('records', [{ id: 1 }, { id: Number.NaN }]);
    }).toThrow(TypeError);
    expect(pgm.getSqlSteps()).toEqual(['SELECT 1;']);
  });

  it('leaves queued statements unchanged when an insert value is rejected', () => {
    const pgm = new MigrationBuilder(
      { query: vi.fn(), select: vi.fn() },
      undefined,
      false,
      console
    );
    pgm.sql('SELECT 1');
    expect(() => {
      pgm.insert('records', { valid: 1, invalid: Number.NaN });
    }).toThrow(TypeError);
    expect(pgm.getSqlSteps()).toEqual(['SELECT 1;']);
  });

  it('queues inserts after table creation without querying the database', () => {
    const db = { query: vi.fn(), select: vi.fn() };
    const pgm = new MigrationBuilder(db, undefined, false, console);

    pgm.createTable('media_types', { name: 'text' });
    pgm.insert('media_types', { name: 'ebook' });

    expect(pgm.getSqlSteps()).toEqual([
      'CREATE TABLE "media_types" ("name" text);',
      'INSERT INTO "media_types" ("name") VALUES ($pga$ebook$pga$);',
    ]);
    expect(db.query).not.toHaveBeenCalled();
    expect(db.select).not.toHaveBeenCalled();
  });

  it('requires an explicit down migration for inserts', () => {
    const pgm = new MigrationBuilder(
      { query: vi.fn(), select: vi.fn() },
      undefined,
      false,
      console
    );
    pgm.enableReverseMode();

    expect(() => {
      pgm.insert('media_types', { name: 'ebook' });
    }).toThrow(
      'Impossible to automatically infer down migration for "pgm.insert()"'
    );
    expect(pgm.getSqlSteps()).toEqual([]);
  });

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

  const storageOptionOperations: Array<{
    name: string;
    expectedSql: string;
    queue: (pgm: MigrationBuilder, parameters: Record<string, number>) => void;
  }> = [
    {
      name: 'createIndex',
      expectedSql:
        'CREATE INDEX "films_title_index" ON "films" ("title") WITH ("positive" = 70, "negative" = -1, "zero" = 0, "decimal" = 0.5);',
      queue: (pgm, storageParameters) => {
        pgm.createIndex('films', 'title', { storageParameters });
      },
    },
    {
      name: 'addIndex',
      expectedSql:
        'CREATE INDEX "films_title_index" ON "films" ("title") WITH ("positive" = 70, "negative" = -1, "zero" = 0, "decimal" = 0.5);',
      queue: (pgm, storageParameters) => {
        pgm.addIndex('films', 'title', { storageParameters });
      },
    },
    {
      name: 'createView',
      expectedSql:
        'CREATE VIEW "v" WITH ("positive" = 70, "negative" = -1, "zero" = 0, "decimal" = 0.5) AS SELECT 1;',
      queue: (pgm, options) => {
        pgm.createView('v', { options }, 'SELECT 1');
      },
    },
    {
      name: 'alterView',
      expectedSql:
        'ALTER VIEW "v" SET ("positive" = 70, "negative" = -1, "zero" = 0, "decimal" = 0.5);',
      queue: (pgm, options) => {
        pgm.alterView('v', { options });
      },
    },
    {
      name: 'createMaterializedView',
      expectedSql:
        'CREATE MATERIALIZED VIEW "v" WITH ("positive" = 70, "negative" = -1, "zero" = 0, "decimal" = 0.5) AS SELECT 1;',
      queue: (pgm, storageParameters) => {
        pgm.createMaterializedView('v', { storageParameters }, 'SELECT 1');
      },
    },
    {
      name: 'alterMaterializedView',
      expectedSql:
        'ALTER MATERIALIZED VIEW "v" SET ("positive" = 70, "negative" = -1, "zero" = 0, "decimal" = 0.5);',
      queue: (pgm, storageParameters) => {
        pgm.alterMaterializedView('v', { storageParameters });
      },
    },
  ];

  describe.each(storageOptionOperations)(
    '$name option validation',
    ({ queue, expectedSql }) => {
      it('queues finite positive, negative, zero and decimal options', () => {
        const db = { query: vi.fn(), select: vi.fn() };
        const pgm = new MigrationBuilder(db, undefined, false, console);

        queue(pgm, { positive: 70, negative: -1, zero: 0, decimal: 0.5 });

        expect(pgm.getSqlSteps()).toEqual([expectedSql]);
        expect(db.query).not.toHaveBeenCalled();
        expect(db.select).not.toHaveBeenCalled();
      });

      it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
        'rejects %s with option context and preserves queued SQL',
        (value) => {
          const db = { query: vi.fn(), select: vi.fn() };
          const pgm = new MigrationBuilder(db, undefined, false, console);
          pgm.sql('SELECT 1');
          const parameters = { valid_before: 70, invalid_option: value };

          expect(() => {
            queue(pgm, parameters);
          }).toThrow(TypeError);
          expect(() => {
            queue(pgm, parameters);
          }).toThrow(
            `Invalid value for option "invalid_option": ${String(value)}. Expected a finite number.`
          );
          expect(pgm.getSqlSteps()).toEqual(['SELECT 1;']);

          pgm.sql('SELECT 2');

          expect(pgm.getSqlSteps()).toEqual(['SELECT 1;', 'SELECT 2;']);
          expect(db.query).not.toHaveBeenCalled();
          expect(db.select).not.toHaveBeenCalled();
        }
      );
    }
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'preserves %s in defaults and SQL templates outside storage options',
    (value) => {
      const pgm = new MigrationBuilder(
        { query: vi.fn(), select: vi.fn() },
        undefined,
        false,
        console
      );

      pgm.createTable('records', {
        amount: { type: 'numeric', default: value },
      });
      pgm.sql('SELECT {value}', { value });

      expect(pgm.getSqlSteps()).toEqual([
        `CREATE TABLE "records" ("amount" numeric DEFAULT ${String(value)});`,
        `SELECT ${String(value)};`,
      ]);
    }
  );

  it.each([new Date(0), new Map(), { count: 1n }, () => {}])(
    'leaves queued SQL unchanged for an unsupported default: %s',
    (value) => {
      const pgm = new MigrationBuilder(
        { query: vi.fn(), select: vi.fn() },
        undefined,
        false,
        console
      );
      pgm.sql('SELECT 1');

      expect(() => {
        pgm.createTable('records', {
          document: { type: 'jsonb', default: value },
        });
      }).toThrow(TypeError);
      expect(pgm.getSql()).toBe('SELECT 1;\n');
    }
  );

  it('serializes an interface-typed default with a name property as JSON', () => {
    interface Document {
      name: string;
      age: number;
    }
    const document: Document = { name: 'Alice', age: 3 };
    const pgm = new MigrationBuilder(
      { query: vi.fn(), select: vi.fn() },
      undefined,
      false,
      console
    );
    pgm.addColumns('records', {
      document: { type: 'jsonb', default: document },
    });
    expect(pgm.getSql()).toContain(
      'DEFAULT $pga${"name":"Alice","age":3}$pga$'
    );
  });

  it('leaves queued SQL unchanged when a default cannot be serialized', () => {
    const pgm = new MigrationBuilder(
      { query: vi.fn(), select: vi.fn() },
      undefined,
      false,
      console,
      false
    );
    pgm.sql('SELECT 1');
    const value: Record<string, unknown> = {};
    value.self = value;

    expect(() => {
      pgm.createTable('records', {
        document: { type: 'jsonb', default: value },
      });
    }).toThrow(TypeError);
    expect(pgm.getSql()).toBe('SELECT 1;\n');
  });

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

  it('automatically reverses columns with check callbacks without evaluating them', () => {
    const check = vi.fn((column: string) => `${column} > 0`);
    const pgm = new MigrationBuilder(
      { query: vi.fn(), select: vi.fn() },
      { price: { type: 'numeric', check } },
      false,
      console,
      false
    );
    pgm.enableReverseMode();

    pgm.createTable('products', { retail_price: 'price' });
    pgm.addColumns('products', { wholesale_price: 'price' });

    expect(pgm.getSql()).toBe(
      'ALTER TABLE "products" DROP "wholesale_price";\nDROP TABLE "products";\n'
    );
    expect(check).not.toHaveBeenCalled();
  });

  it.each(['createTable', 'addColumns'] as const)(
    'leaves the queue unchanged when a check callback throws in %s',
    (operation) => {
      const pgm = new MigrationBuilder(
        { query: vi.fn(), select: vi.fn() },
        undefined,
        false,
        console,
        false
      );
      pgm.sql('SELECT 1;');

      expect(() => {
        pgm[operation]('products', {
          first: 'integer',
          price: {
            type: 'numeric',
            check: () => {
              throw new Error('Cannot build price check');
            },
          },
        });
      }).toThrow('Cannot build price check');
      expect(pgm.getSql()).toBe('SELECT 1;\n');
    }
  );
});
