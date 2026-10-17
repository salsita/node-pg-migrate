import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateStressSchema } from '../fixtures/generate';
import {
  createDatabase,
  databaseUrl,
  dumpSchema,
  E2E_TIMEOUT,
  loadSql,
  PG_VERSIONS,
  pgDumpShim,
  runCli,
  setupPostgresDatabase,
} from './utils';

/**
 * How many tables the stress schema has.
 */
const TABLES = 5000;

/**
 * Loading, dumping and applying thousands of tables takes minutes.
 */
const STRESS_TIMEOUT = Math.max(E2E_TIMEOUT, 20 * 60_000);

/**
 * Runs a query with `psql` inside a container.
 *
 * @param container The PostgreSQL container.
 * @param database The database to query.
 * @param sql The query.
 *
 * @returns The rows, one line each (`psql -At`).
 */
async function query(
  container: StartedPostgreSqlContainer,
  database: string,
  sql: string
): Promise<string[]> {
  const res = await container.exec([
    'psql',
    '-X',
    '-At',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    container.getUsername(),
    '-d',
    database,
    '-c',
    sql,
  ]);
  if (res.exitCode !== 0) {
    throw new Error(`query failed in "${database}": ${res.stderr}`);
  }

  return res.stdout.split('\n').filter(Boolean);
}

/**
 * Runs a step of the story and logs how long it took.
 *
 * @param label What the step does.
 * @param step The step.
 *
 * @returns What the step returned.
 */
async function timed<T>(label: string, step: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await step();
  } finally {
    const seconds = (performance.now() - start) / 1000;
    console.log(`[baseline stress] ${label}: ${seconds.toFixed(1)} s`);
  }
}

describe.runIf(process.env.PGM_E2E_STRESS === '1').each(PG_VERSIONS)(
  'baseline of a schema with 5,000 tables (PG %s)',
  (postgresVersion) => {
    const image = `postgres:${postgresVersion}-alpine`;
    let container: StartedPostgreSqlContainer;
    let pgDump: string;
    let cwd: string;

    beforeAll(async () => {
      container = await setupPostgresDatabase(image);
      pgDump = await pgDumpShim(container);
      cwd = await mkdtemp(join(tmpdir(), 'pgm-e2e-baseline-stress-'));
    });

    afterAll(async () => {
      await container?.stop();
      if (pgDump) {
        await rm(dirname(pgDump), { recursive: true, force: true });
      }

      if (cwd) {
        await rm(cwd, { recursive: true, force: true });
      }
    });

    it(
      'says how many locks it needs, and blank databases need them',
      { timeout: STRESS_TIMEOUT },
      async () => {
        await createDatabase(container, 'stress_source');
        await timed(`PG ${postgresVersion}, load ${TABLES} tables`, () =>
          loadSql(container, 'stress_source', generateStressSchema(TABLES))
        );

        const baseline = await timed(`PG ${postgresVersion}, baseline`, () =>
          runCli(['baseline', '--pg-dump', pgDump, '-m', 'migrations'], {
            cwd,
            env: { DATABASE_URL: databaseUrl(container, 'stress_source') },
          })
        );
        expect(baseline.code, baseline.stderr).toBe(0);
        const files = await readdir(join(cwd, 'migrations'));
        expect(files).toEqual([expect.stringMatching(/^\d+_baseline\.sql$/)]);
        const name = files[0].slice(0, -'.sql'.length);

        // The header says which value blank databases need, and the warning
        // repeats it.
        const migration = await readFile(
          join(cwd, 'migrations', files[0]),
          'utf8'
        );
        const required = Number(
          /max_locks_per_transaction = (\d+) or more/.exec(migration)?.[1]
        );
        expect(required).toBeGreaterThan(64);
        const warning = baseline.stderr
          .split('\n')
          .find(
            (line) =>
              line.startsWith('> Warning: ') &&
              line.includes('max_locks_per_transaction')
          );
        expect(warning).toMatch(new RegExp(String.raw`\b${required}\b`));
        console.log(
          `[baseline stress] PG ${postgresVersion}, max_locks_per_transaction = ${required}`
        );

        // With the default setting the baseline can't lock all it creates.
        await createDatabase(container, 'stress_blank');
        expect(
          await query(
            container,
            'stress_blank',
            'SHOW max_locks_per_transaction'
          )
        ).toEqual(['64']);
        const tooFewLocks = await timed(
          `PG ${postgresVersion}, up with max_locks_per_transaction = 64`,
          () =>
            runCli(['up'], {
              cwd,
              env: { DATABASE_URL: databaseUrl(container, 'stress_blank') },
            })
        );
        expect(tooFewLocks.code).toBe(1);
        expect(tooFewLocks.stderr).toContain('53200');
        expect(tooFewLocks.stderr).toContain('out of shared memory');

        // A server started with the value the baseline asked for applies it.
        const roomy = await timed(
          `PG ${postgresVersion}, start a server with max_locks_per_transaction = ${required}`,
          () =>
            new PostgreSqlContainer(image)
              .withUsername('ubuntu')
              .withPassword('ubuntu')
              .withDatabase('node_pg_migrate')
              .withCommand([
                'postgres',
                '-c',
                `max_locks_per_transaction=${required}`,
              ])
              .start()
        );
        try {
          await createDatabase(roomy, 'stress_target');
          expect(
            await query(
              roomy,
              'stress_target',
              'SHOW max_locks_per_transaction'
            )
          ).toEqual([String(required)]);

          const applied = await timed(
            `PG ${postgresVersion}, up with max_locks_per_transaction = ${required}`,
            () =>
              runCli(['up'], {
                cwd,
                env: { DATABASE_URL: databaseUrl(roomy, 'stress_target') },
              })
          );
          expect(applied.code, applied.stderr).toBe(0);
          expect(
            await query(
              roomy,
              'stress_target',
              'SELECT name FROM public.pgmigrations ORDER BY id'
            )
          ).toEqual([name]);

          // Compared as a boolean: a diff of two 10 MB dumps is no help.
          const same =
            (await dumpSchema(roomy, 'stress_target')) ===
            (await dumpSchema(container, 'stress_source'));
          expect(same, 'the schema built from the baseline').toBe(true);
        } finally {
          await roomy.stop();
        }
      }
    );
  }
);
