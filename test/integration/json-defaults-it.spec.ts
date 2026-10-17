import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { MigrationMap } from '../../src';
import { runner } from '../../src';
import {
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

const schema = 'json.defaults';
const table = { schema, name: 'records"名' };
const domain = { schema, name: 'document' };
const view = { schema, name: 'records_view' };
const fn = { schema, name: 'default_document' };
const tableSql = '"json.defaults"."records""名"';
const initial = {
  attempts: 0,
  uploads: 0,
  nested: { enabled: false, items: [1, 'two', null] },
  text: "user's $pga$ $pgb$ value; DROP TABLE records; --",
};
const updated = { attempts: 1 };

describe.each(PG_VERSIONS)(
  'JSON defaults (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'json_defaults'
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

    afterEach(async () => {
      await client.query('DROP SCHEMA IF EXISTS "json.defaults" CASCADE');
      await client.query('DROP TABLE IF EXISTS public.pgmigrations');
    });

    it.each(['json', 'jsonb'])(
      'creates, alters and reverses %s defaults without changing existing rows',
      async (type) => {
        const migrations: MigrationMap = {
          '001_create': {
            up(pgm) {
              pgm.createSchema(schema);
              pgm.createDomain(domain, type, { default: initial });
              pgm.createTable(table, {
                id: { type: 'integer', primaryKey: true },
                document: { type, notNull: true, default: initial },
                domain_document: { type: '"json.defaults"."document"' },
                sql_array: { type: 'integer[]', default: [1, 2] },
                literal: { type, default: pgm.func(`'{}'::${type}`) },
                serialized: { type, default: JSON.stringify(initial) },
              });
              pgm.addColumns(table, { added: { type, default: {} } });
              pgm.createFunction(
                fn,
                [{ name: 'document', type, default: initial }],
                { returns: type, language: 'sql' },
                'SELECT document'
              );
              pgm.createView(view, {}, `SELECT * FROM ${tableSql}`);
            },
          },
          '002_alter': {
            up(pgm) {
              pgm.alterColumn(table, 'document', { default: updated });
              pgm.alterDomain(domain, { default: updated });
              pgm.alterViewColumn(view, 'added', { default: updated });
              pgm.alterColumn(table, 'added', { default: null });
            },
            down(pgm) {
              pgm.alterColumn(table, 'document', { default: initial });
              pgm.alterDomain(domain, { default: initial });
              pgm.alterViewColumn(view, 'added', { default: null });
              pgm.alterColumn(table, 'added', { default: {} });
            },
          },
        };
        const migrate = (direction: 'up' | 'down') =>
          runner({
            databaseUrl: container.getConnectionUri(),
            migrations,
            migrationsSchema: 'public',
            migrationsTable: 'pgmigrations',
            direction,
            count: 1,
            log: () => {},
          });

        await migrate('up');
        const original = (
          await client.query(
            `INSERT INTO ${tableSql} (id) VALUES (1) RETURNING *`
          )
        ).rows;
        expect(original).toEqual([
          {
            id: 1,
            document: initial,
            domain_document: initial,
            sql_array: [1, 2],
            literal: {},
            serialized: initial,
            added: {},
          },
        ]);
        expect(
          (
            await client.query(
              'SELECT "json.defaults".default_document() AS value'
            )
          ).rows
        ).toEqual([{ value: initial }]);

        await migrate('up');
        expect(
          (
            await client.query(
              `INSERT INTO ${tableSql} (id) VALUES (2) RETURNING document, domain_document, added`
            )
          ).rows
        ).toEqual([
          { document: updated, domain_document: updated, added: null },
        ]);
        expect(
          (
            await client.query(
              'INSERT INTO "json.defaults".records_view (id) VALUES (3) RETURNING added'
            )
          ).rows
        ).toEqual([{ added: updated }]);
        expect(
          (await client.query(`SELECT * FROM ${tableSql} WHERE id = 1`)).rows
        ).toEqual(original);

        await migrate('down');
        expect(
          (
            await client.query(
              `INSERT INTO ${tableSql} (id) VALUES (4) RETURNING document, domain_document, added`
            )
          ).rows
        ).toEqual([{ document: initial, domain_document: initial, added: {} }]);

        await migrate('down');
        expect(
          (await client.query('SELECT to_regclass($1) AS name', [tableSql]))
            .rows
        ).toEqual([{ name: null }]);
      }
    );
  }
);
