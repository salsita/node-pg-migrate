import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { runner } from '../../src';
import {
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

const migrationNames = [
  '1000000000000_create_comments',
  '1000000000001_alter_comment',
  '1000000000002_remove_comment',
  '1000000000003_empty_comment',
];
const initialComment = "Initial '説明'\n$pga$ and $$";
const updatedComment = 'Updated comment ending in $pga';

describe.each(PG_VERSIONS)(
  'policy comments (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;
    let reader: pg.Client;
    let dir: string;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'policy_comments'
      );
      client = new pg.Client(container.getConnectionUri());
      await client.connect();
      await client.query(
        "CREATE ROLE comment_reader LOGIN PASSWORD 'comment_reader' NOSUPERUSER NOBYPASSRLS"
      );
      const readerUri = new URL(container.getConnectionUri());
      readerUri.username = 'comment_reader';
      readerUri.password = 'comment_reader';
      reader = new pg.Client(readerUri.toString());
      await reader.connect();
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      try {
        if (reader) {
          await reader.end();
        }
        if (client) {
          await client.end();
        }
      } finally {
        if (container) {
          await container.stop();
        }
      }
    });

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'pgm-policy-comments-'));
      await client.query(`
      CREATE SCHEMA "policy.schema";
      CREATE TABLE "policy.schema"."record""表" (id integer PRIMARY KEY);
      INSERT INTO "policy.schema"."record""表" VALUES (1), (2), (3);
      ALTER TABLE "policy.schema"."record""表" ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA "policy.schema" TO comment_reader;
      GRANT SELECT, INSERT ON "policy.schema"."record""表" TO comment_reader;
    `);
    });

    afterEach(async () => {
      try {
        await client.query('DROP SCHEMA IF EXISTS "policy.schema" CASCADE');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    async function catalog() {
      return (
        await client.query<{
          oid: number;
          name: string;
          permissive: boolean;
          roles: number[];
          using: string;
          check: string;
          comment: string | null;
        }>(`
      SELECT oid, polname AS name, polpermissive AS permissive, polroles AS roles,
        pg_get_expr(polqual, polrelid) AS using,
        pg_get_expr(polwithcheck, polrelid) AS check,
        obj_description(oid, 'pg_policy') AS comment
      FROM pg_policy WHERE polrelid = '"policy.schema"."record""表"'::regclass
      ORDER BY polname
    `)
      ).rows;
    }

    async function visibleRows() {
      return (
        await reader.query<{ id: number }>(
          'SELECT id FROM "policy.schema"."record""表" ORDER BY id'
        )
      ).rows;
    }

    async function migrate(direction: 'up' | 'down') {
      return runner({
        databaseUrl: container.getConnectionUri(),
        dir,
        schema: 'public',
        migrationsSchema: 'policy.schema',
        migrationsTable: 'pgmigrations',
        count: 1,
        direction,
        singleTransaction: true,
        log: () => {},
      });
    }

    it('creates, replaces, and removes comments without changing policy identities, expressions, or RLS', async () => {
      const tableDeclaration = `const table = { schema: 'policy.schema', name: 'record"表' };`;
      const policy = JSON.stringify('policy"名');
      const initial = JSON.stringify(initialComment);
      const updated = JSON.stringify(updatedComment);
      await writeFile(
        join(dir, `${migrationNames[0]}.mjs`),
        `${tableDeclaration}
      export function up(pgm) {
        pgm.createPolicy(table, 'allow_rows', {
          as: 'PERMISSIVE', role: 'comment_reader', using: 'id > 0', check: 'id > 0',
          comment: 'Permissive baseline',
        });
        pgm.createPolicy(table, ${policy}, {
          as: 'RESTRICTIVE', role: 'comment_reader', using: 'id < 3', check: 'id < 3',
          comment: ${initial},
        });
      }
    `
      );
      await writeFile(
        join(dir, `${migrationNames[1]}.mjs`),
        `${tableDeclaration}
      export function up(pgm) { pgm.alterPolicy(table, ${policy}, { comment: ${updated} }); }
      export function down(pgm) { pgm.alterPolicy(table, ${policy}, { comment: ${initial} }); }
    `
      );
      await writeFile(
        join(dir, `${migrationNames[2]}.mjs`),
        `${tableDeclaration}
      export function up(pgm) { pgm.alterPolicy(table, ${policy}, { comment: null }); }
      export function down(pgm) { pgm.alterPolicy(table, ${policy}, { comment: ${updated} }); }
    `
      );
      await writeFile(
        join(dir, `${migrationNames[3]}.mjs`),
        `${tableDeclaration}
      export function up(pgm) {
        pgm.alterPolicy(table, ${policy}, { comment: 'Temporary note' });
        pgm.alterPolicy(table, ${policy}, { comment: '' });
      }
      export function down(pgm) { pgm.alterPolicy(table, ${policy}, { comment: null }); }
    `
      );

      expect(
        (
          await reader.query<{ superuser: boolean; bypass: boolean }>(`
      SELECT rolsuper AS superuser, rolbypassrls AS bypass FROM pg_roles WHERE rolname = current_user
    `)
        ).rows
      ).toEqual([{ superuser: false, bypass: false }]);
      expect(await visibleRows()).toEqual([]);
      await migrate('up');
      const original = await catalog();
      expect(
        original.map(({ name, permissive, using, check, comment }) => ({
          name,
          permissive,
          using,
          check,
          comment,
        }))
      ).toEqual([
        {
          name: 'allow_rows',
          permissive: true,
          using: '(id > 0)',
          check: '(id > 0)',
          comment: 'Permissive baseline',
        },
        {
          name: 'policy"名',
          permissive: false,
          using: '(id < 3)',
          check: '(id < 3)',
          comment: initialComment,
        },
      ]);

      async function expectPolicies(comment: string | null) {
        expect(await catalog()).toEqual(
          original.map((row) =>
            row.name === 'policy"名' ? Object.assign({}, row, { comment }) : row
          )
        );
        expect(await visibleRows()).toEqual([{ id: 1 }, { id: 2 }]);
        await expect(
          reader.query('INSERT INTO "policy.schema"."record""表" VALUES (4)')
        ).rejects.toMatchObject({ code: '42501' });
        await expect(
          reader.query('INSERT INTO "policy.schema"."record""表" VALUES (0)')
        ).rejects.toMatchObject({ code: '42501' });
      }

      await expectPolicies(initialComment);
      await migrate('up');
      await expectPolicies(updatedComment);
      await migrate('up');
      await expectPolicies(null);
      await migrate('up');
      await expectPolicies(null);
      await migrate('down');
      await expectPolicies(null);
      await migrate('down');
      await expectPolicies(updatedComment);
      await migrate('down');
      await expectPolicies(initialComment);
      await migrate('down');
      expect(await catalog()).toEqual([]);
      expect(await visibleRows()).toEqual([]);
      expect(
        (
          await client.query<{ count: number }>(
            'SELECT count(*)::int AS count FROM "policy.schema".pgmigrations'
          )
        ).rows
      ).toEqual([{ count: 0 }]);
    });
  }
);
