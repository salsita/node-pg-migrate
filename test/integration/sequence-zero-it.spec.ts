import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { alterSequence, createSequence } from '../../src/operations/sequences';
import { createTable } from '../../src/operations/tables';
import { options1 } from '../presetMigrationOptions';
import {
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

describe.each(PG_VERSIONS)(
  'sequence zero options (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'sequence_zero'
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

    it('creates a zero-based sequence', async () => {
      await client.query(
        createSequence(options1)('zero_based', { minvalue: 0, start: 0 })
      );

      expect(
        (
          await client.query<{ min_value: string; start_value: string }>(
            `SELECT min_value, start_value
             FROM pg_sequences
             WHERE sequencename = 'zero_based'`
          )
        ).rows
      ).toEqual([{ min_value: '0', start_value: '0' }]);
      expect(
        (await client.query(`SELECT nextval('zero_based') AS value`)).rows
      ).toEqual([{ value: '0' }]);
    });

    it('creates a descending sequence ending at zero', async () => {
      await client.query(
        createSequence(options1)('descending', {
          increment: -1,
          maxvalue: 0,
        })
      );

      expect(
        (await client.query(`SELECT nextval('descending') AS value`)).rows
      ).toEqual([{ value: '0' }]);
    });

    it('restarts a sequence at zero', async () => {
      await client.query(
        createSequence(options1)('restartable', { minvalue: 0 })
      );
      await client.query(`SELECT nextval('restartable')`);
      await client.query(`SELECT nextval('restartable')`);

      await client.query(
        alterSequence(options1)('restartable', { restart: 0 })
      );

      expect(
        (await client.query(`SELECT nextval('restartable') AS value`)).rows
      ).toEqual([{ value: '0' }]);
    });

    it('creates an identity column starting at zero', async () => {
      await client.query(
        createTable(options1)('zero_identity', {
          id: {
            type: 'integer',
            sequenceGenerated: { precedence: 'ALWAYS', minvalue: 0, start: 0 },
          },
          name: { type: 'text' },
        })
      );

      expect(
        (
          await client.query(
            `INSERT INTO zero_identity (name) VALUES ('a'), ('b') RETURNING id`
          )
        ).rows
      ).toEqual([{ id: 0 }, { id: 1 }]);
    });
  }
);
