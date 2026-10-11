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
];
const initialComment = 'Initial comment';
const updatedComment = 'Updated comment';

describe.each(PG_VERSIONS)(
  'policy comments (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;
    let dir: string;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'policy_comments'
      );
      client = new pg.Client(container.getConnectionUri());
      await client.connect();
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      try {
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
    `);
    });

    afterEach(async () => {
      try {
        await client.query('DROP SCHEMA IF EXISTS "policy.schema" CASCADE');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    async function comments() {
      return (
        await client.query<{ comment: string | null }>(`
      SELECT obj_description(oid, 'pg_policy') AS comment
      FROM pg_policy WHERE polrelid = '"policy.schema"."record""表"'::regclass
    `)
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

    it('creates, alters, removes, and rolls back a policy comment', async () => {
      const tableDeclaration = `const table = { schema: 'policy.schema', name: 'record"表' };`;
      const policy = JSON.stringify('policy"名');
      const initial = JSON.stringify(initialComment);
      const updated = JSON.stringify(updatedComment);
      await writeFile(
        join(dir, `${migrationNames[0]}.mjs`),
        `${tableDeclaration}
      export function up(pgm) {
        pgm.createPolicy(table, ${policy}, {
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
      await migrate('up');
      async function expectComment(comment: string | null) {
        expect(await comments()).toEqual([{ comment }]);
      }

      await expectComment(initialComment);
      await migrate('up');
      await expectComment(updatedComment);
      await migrate('up');
      await expectComment(null);
      await migrate('down');
      await expectComment(updatedComment);
      await migrate('down');
      await expectComment(initialComment);
      await migrate('down');
      expect(await comments()).toEqual([]);
    });
  }
);
