import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
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
import type { MigrationMap } from '../../src';
import { runner } from '../../src';
import {
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

const viewName = { schema: 'view_options', name: 'SelectedRecords' };

describe.each(PG_VERSIONS)(
  'view options (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'view_options'
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
      await client.query('CREATE SCHEMA view_options');
      await client.query(
        'CREATE TABLE view_options.records (id integer, payload text)'
      );
      await client.query(
        "INSERT INTO view_options.records VALUES (1, 'first'), (2, 'second')"
      );
    });

    afterEach(async () => {
      await client.query('DROP SCHEMA view_options CASCADE');
    });

    function migrate(
      migrations: MigrationMap,
      direction: 'up' | 'down' = 'up',
      count = 1
    ) {
      return runner({
        databaseUrl: container.getConnectionUri(),
        migrations,
        migrationsSchema: 'view_options',
        migrationsTable: 'pgmigrations',
        schema: 'public',
        decamelize: true,
        singleTransaction: true,
        direction,
        count,
        log: () => {},
      });
    }

    async function catalog() {
      return (
        await client.query<{
          options: string[] | null;
          toast_options: string[] | null;
        }>(`
      SELECT v.reloptions AS options, t.reloptions AS toast_options
      FROM pg_class v JOIN pg_namespace n ON n.oid = v.relnamespace
      LEFT JOIN pg_class t ON t.oid = v.reltoastrelid
      WHERE n.nspname = 'view_options' AND v.relname = 'selected_records'
    `)
      ).rows;
    }

    async function expectReversed() {
      expect(await catalog()).toEqual([]);
      expect(
        (await client.query('SELECT name FROM view_options.pgmigrations')).rows
      ).toEqual([]);
      expect(
        (await client.query('SELECT * FROM view_options.records ORDER BY id'))
          .rows
      ).toEqual([
        { id: 1, payload: 'first' },
        { id: 2, payload: 'second' },
      ]);
    }

    it('creates, alters and resets view options, then infers the create reversal', async () => {
      const migrations: MigrationMap = {
        '1000000000000_create': {
          up: (pgm) => {
            pgm.createView(
              viewName,
              { options: { CHECK_OPTION: 'LOCAL', SECURITY_BARRIER: true } },
              'SELECT * FROM view_options.records WHERE id > 0'
            );
          },
        },
        '1000000000001_alter': {
          up: (pgm) => {
            pgm.alterView(viewName, {
              checkOption: 'CASCADED',
              options: { SECURITY_BARRIER: false },
            });
          },
          down: (pgm) => {
            pgm.alterView(viewName, {
              options: { CHECK_OPTION: null, SECURITY_BARRIER: null },
            });
          },
        },
      };
      await migrate(migrations);
      expect((await catalog())[0].options).toEqual([
        'check_option=LOCAL',
        'security_barrier=true',
      ]);
      await expect(
        client.query(
          'INSERT INTO view_options.selected_records VALUES (-1, NULL)'
        )
      ).rejects.toMatchObject({ code: '44000' });
      await migrate(migrations);
      expect((await catalog())[0].options).toEqual([
        'security_barrier=false',
        'check_option=CASCADED',
      ]);
      await migrate(migrations, 'down');
      expect((await catalog())[0].options).toBeNull();
      await migrate(migrations, 'down');
      await expectReversed();
    });

    it('preserves materialized-view storage parameters and toast SET/RESET semantics', async () => {
      const migrations: MigrationMap = {
        '1000000000000_create': {
          up: (pgm) => {
            pgm.createMaterializedView(
              viewName,
              {
                storageParameters: {
                  FillFactor: 70,
                  Autovacuum_enabled: true,
                  autovacuum_vacuum_scale_factor: 0,
                  'TOAST.Autovacuum_enabled': false,
                },
              },
              'SELECT * FROM view_options.records'
            );
          },
        },
        '1000000000001_alter': {
          up: (pgm) => {
            pgm.alterMaterializedView(viewName, {
              storageParameters: {
                FillFactor: 80,
                'TOAST.Autovacuum_enabled': true,
              },
            });
          },
          down: (pgm) => {
            pgm.alterMaterializedView(viewName, {
              storageParameters: {
                FillFactor: null,
                Autovacuum_enabled: null,
                autovacuum_vacuum_scale_factor: null,
                'TOAST.Autovacuum_enabled': null,
              },
            });
          },
        },
      };
      await migrate(migrations);
      expect(await catalog()).toEqual([
        {
          options: [
            'fillfactor=70',
            'autovacuum_enabled=true',
            'autovacuum_vacuum_scale_factor=0',
          ],
          toast_options: ['autovacuum_enabled=false'],
        },
      ]);
      await migrate(migrations);
      expect((await catalog())[0]).toEqual({
        options: [
          'autovacuum_enabled=true',
          'autovacuum_vacuum_scale_factor=0',
          'fillfactor=80',
        ],
        toast_options: ['autovacuum_enabled=true'],
      });
      await migrate(migrations, 'down');
      expect(await catalog()).toEqual([{ options: null, toast_options: null }]);
      expect(
        (
          await client.query(
            'SELECT * FROM view_options.selected_records ORDER BY id'
          )
        ).rows
      ).toEqual([
        { id: 1, payload: 'first' },
        { id: 2, payload: 'second' },
      ]);
      await migrate(migrations, 'down');
      await expectReversed();
    });

    it.each(['create', 'alter'] as const)(
      'keeps SQL-looking %s option values inside one literal',
      async (operation) => {
        await client.query(
          'CREATE VIEW view_options.selected_records AS SELECT * FROM view_options.records'
        );
        const migrations: MigrationMap = {
          '1000000000000_invalid': {
            up: (pgm) => {
              const options = {
                check_option:
                  "local$pga$'); DROP TABLE view_options.records CASCADE; --",
              };
              if (operation === 'create') {
                pgm.createView(
                  viewName,
                  { replace: true, options },
                  'SELECT * FROM view_options.records'
                );
              } else {
                pgm.alterView(viewName, { options });
              }
            },
          },
        };
        await expect(migrate(migrations)).rejects.toMatchObject({
          code: '22023',
        });
        expect((await catalog())[0].options).toBeNull();
        expect(
          (
            await client.query(
              'SELECT count(*)::integer AS count FROM view_options.records'
            )
          ).rows
        ).toEqual([{ count: 2 }]);
        expect(
          (await client.query('SELECT name FROM view_options.pgmigrations'))
            .rows
        ).toEqual([]);
      }
    );
  }
);
