import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { baseline } from '../../../src';
import type { BaselineResult } from '../../../src';
import { generateStressSchema } from '../../fixtures/generate';
import {
  createDatabase,
  databaseUrl,
  INTEGRATION_TIMEOUT,
  loadSql,
  PG_VERSIONS,
  setupPostgresDatabase,
} from '../utils';
import type { RecordingLogger } from './helpers';
import { pgDumpFile, recordingLogger, workDir } from './helpers';

/**
 * A baseline and the queries it ran on its client.
 */
interface CountedBaseline {
  readonly queries: string[];
  readonly result: BaselineResult;
  readonly logger: RecordingLogger;
}

/**
 * Makes a client record the text of every query it runs.
 *
 * @param client The client.
 * @param queries Where to record the queries.
 */
function recordQueries(client: pg.Client, queries: string[]): void {
  const query = client.query.bind(client) as (...args: unknown[]) => unknown;
  client.query = ((...args: unknown[]) => {
    const [config] = args;
    queries.push(
      typeof config === 'string' ? config : JSON.stringify(config ?? null)
    );

    return query(...args);
  }) as typeof client.query;
}

describe.each(PG_VERSIONS)(
  'baseline() queries (PG %s)',
  // Creating 1,000 tables takes about 5 s on an idle server, and many times
  // that while the other integration files load their fixtures.
  { timeout: INTEGRATION_TIMEOUT * 6 },
  (postgresVersion) => {
    let container: StartedPostgreSqlContainer;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${postgresVersion}-alpine`
      );
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      await container?.stop();
    });

    /**
     * Writes the baseline of a generated schema from its pg_dump file,
     * through a client that records its queries.
     *
     * @param database The name of the new database.
     * @param tables How many tables to generate in it.
     *
     * @returns The baseline and the queries it ran.
     */
    async function countedBaseline(
      database: string,
      tables: number
    ): Promise<CountedBaseline> {
      await createDatabase(container, database);
      await loadSql(container, database, generateStressSchema(tables));
      const work = await workDir();
      const fromFile = join(work, `${database}.sql`);
      await pgDumpFile(container, database, fromFile);
      const client = new pg.Client(databaseUrl(container, database));
      await client.connect();
      try {
        const queries: string[] = [];
        recordQueries(client, queries);
        const logger = recordingLogger();

        const result = await baseline({
          dbClient: client,
          fromFile,
          dir: join(work, 'migrations'),
          logger,
        });
        const counted = [...queries];

        // baseline() leaves the client open for its owner.
        await expect(client.query('SELECT 1')).resolves.toBeDefined();

        return { queries: counted, result, logger };
      } finally {
        await client.end();
      }
    }

    it('performance: runs as many queries against 1,000 tables as against 10', async () => {
      const small = await countedBaseline('queries_10_tables', 10);
      const large = await countedBaseline('queries_1000_tables', 1000);

      expect(small.queries.length).toBeGreaterThan(0);
      expect(large.queries).toHaveLength(small.queries.length);

      // With 1,000 tables, one transaction needs more locks than the default
      // lock table has room for (max_connections is 100).
      expect(small.result.requiredMaxLocksPerTransaction).toBeUndefined();
      expect(large.result.requiredMaxLocksPerTransaction).toBe(128);
      expect(
        large.result.warnings.filter(
          (warning) =>
            warning.includes('max_locks_per_transaction') &&
            warning.includes('128')
        )
      ).toHaveLength(1);
      expect(large.logger.messages.warn).toEqual(
        large.result.warnings.map((warning) => `> Warning: ${warning}`)
      );
    });
  }
);
