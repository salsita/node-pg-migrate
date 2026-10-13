import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MigrationMap } from '../../src';
import { runner } from '../../src';
import {
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

describe.each(PG_VERSIONS)(
  'column check shorthands (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'column_checks'
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

    it('inherits checks for differently named columns, enforces them, and reverses both migrations', async () => {
      const table = { schema: 'shop', name: 'products' };
      const migrations: MigrationMap = {
        '1000000000000_create_products': {
          shorthands: {
            price: { type: 'numeric', check: (column) => `${column} > 0` },
          },
          up: (pgm) => {
            pgm.createSchema('shop');
            pgm.createTable(table, {
              retailPrice: 'price',
              'price"表': 'price',
            });
          },
        },
        '1000000000001_add_wholesale_price': {
          up: (pgm) => {
            pgm.addColumns(table, { wholesalePrice: 'price' });
          },
        },
      };
      const options = {
        databaseUrl: container.getConnectionUri(),
        migrations,
        migrationsTable: 'pgmigrations',
        migrationsSchema: 'public',
        decamelize: true,
        singleTransaction: true,
        log: () => {},
      };

      await runner({ ...options, direction: 'up' });
      const insert =
        'INSERT INTO shop.products (retail_price, "price""表", wholesale_price) VALUES ($1, $2, $3)';
      await client.query(insert, [10, 20, 30]);
      for (const values of [
        [0, 20, 30],
        [10, -1, 30],
        [10, 20, 0],
      ]) {
        await expect(client.query(insert, values)).rejects.toMatchObject({
          code: '23514',
        });
      }
      expect(
        (await client.query('SELECT count(*)::int AS count FROM shop.products'))
          .rows
      ).toEqual([{ count: 1 }]);

      await runner({ ...options, direction: 'down', count: 1 });
      expect(
        (
          await client.query(
            'SELECT retail_price, "price""表" FROM shop.products'
          )
        ).rows
      ).toEqual([{ retail_price: '10', 'price"表': '20' }]);
      await expect(
        client.query('SELECT wholesale_price FROM shop.products')
      ).rejects.toMatchObject({ code: '42703' });

      await runner({ ...options, direction: 'down', count: 1 });
      expect(
        (await client.query("SELECT to_regclass('shop.products') AS name")).rows
      ).toEqual([{ name: null }]);
      expect(
        (await client.query('SELECT name FROM public.pgmigrations')).rows
      ).toEqual([]);
    });
  }
);
