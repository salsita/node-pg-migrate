import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import type { ExpectStatic } from 'vitest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  cleanupDatabase,
  exec,
  filterIgnoredLines,
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

const SNAPSHOT_FOLDER = '__snapshots__/expression-indexes-it.spec.ts.snap.d/';

describe.each(PG_VERSIONS)(
  'expression indexes (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (postgresVersion) => {
    let pgContainer: StartedPostgreSqlContainer;
    let client: Client;

    beforeAll(async () => {
      const containerImage = `postgres:${postgresVersion}-alpine`;
      pgContainer = await setupPostgresDatabase(
        containerImage,
        `test_expression_indexes_pg_${postgresVersion}`
      );

      client = new Client({
        connectionString: pgContainer.getConnectionUri(),
      });
      await client.connect();
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      if (client) {
        await client.end();
      }

      if (pgContainer) {
        await pgContainer.stop();
      }
    });

    afterEach(async () => {
      await cleanupDatabase(pgContainer);
    });

    function getCommand({ direction }: { direction: 'up' | 'down' }): string {
      const migrationsDir = 'test/integration/migrations-expression-index';
      let command = 'node bin/node-pg-migrate.js';
      if (direction === 'up') {
        command += ` up -m ${migrationsDir}`;
      } else {
        command += ` down -m ${migrationsDir}`;
      }

      return command;
    }

    async function execMigrate(options: {
      expect: ExpectStatic;
      direction: 'up' | 'down';
      connectionString: string;
    }): Promise<{ stdout: string; stderr: string }> {
      const { expect, direction, connectionString } = options;
      const command = getCommand({
        direction,
      });

      const execResult = await exec(command, {
        env: {
          ...process.env,
          DATABASE_URL: connectionString,
        },
      });

      const stderrSnapshot = `${SNAPSHOT_FOLDER}/migrations-${direction}.stderr.log`;
      await expect(filterIgnoredLines(execResult.stderr)).toMatchFileSnapshot(
        stderrSnapshot
      );

      const stdoutSnapshot = `${SNAPSHOT_FOLDER}/migrations-${direction}.pg-${postgresVersion}.stdout.log`;
      await expect(filterIgnoredLines(execResult.stdout)).toMatchFileSnapshot(
        stdoutSnapshot
      );

      return execResult;
    }

    it('should create expression indexes correctly', async () => {
      const connectionString = pgContainer.getConnectionUri();

      await execMigrate({
        expect,
        direction: 'up',
        connectionString,
      });

      const res = await client.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'users'
        ORDER BY indexname;
      `);

      expect(res.rows).toMatchSnapshot();

      await execMigrate({
        expect,
        direction: 'down',
        connectionString,
      });

      const tableRes = await client.query(`
        SELECT to_regclass('public.users');
      `);
      expect(tableRes.rows[0].to_regclass).toBeNull();
    });
  }
);
