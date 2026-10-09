import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { alterDomain } from '../../src/operations/domains';
import { options1 } from '../presetMigrationOptions';
import {
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

describe.each(PG_VERSIONS)(
  'alter domain check constraints (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'alter_domain_check'
      );
      client = new pg.Client(container.getConnectionUri());
      await client.connect();
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      if (client) {
        await client.end();
      }
      if (container) {
        await container.stop();
      }
    });

    it.each([
      { domain: 'anonymous_zipcode', constraintName: undefined },
      { domain: 'named_zipcode', constraintName: 'zipchk' },
    ])('creates and enforces a check on $domain', async (testCase) => {
      await client.query(`CREATE DOMAIN "${testCase.domain}" AS text`);

      const statement = alterDomain(options1)(testCase.domain, {
        check: 'char_length(VALUE) = 5',
        constraintName: testCase.constraintName,
      });
      await client.query(statement);

      await expect(
        client.query(`SELECT '1234'::"${testCase.domain}"`)
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        client.query(`SELECT '12345'::"${testCase.domain}"`)
      ).resolves.toBeDefined();

      expect(
        (
          await client.query<{ count: string }>(
            `SELECT count(*)
             FROM pg_constraint
             WHERE contypid = $1::regtype`,
            [testCase.domain]
          )
        ).rows
      ).toEqual([{ count: '1' }]);
    });
  }
);
