import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  PG_VERSIONS,
  pgDumpShim,
  psqlSelect,
  RAW_COVERAGE_DIR,
  runCli,
  setupPostgresDatabase,
} from './utils';

const { version } = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../package.json'), 'utf8')
) as { version: string };

async function rawCoverageFiles(): Promise<string[]> {
  try {
    return await readdir(RAW_COVERAGE_DIR);
  } catch {
    return [];
  }
}

describe.each(PG_VERSIONS)('e2e smoke (PG %s)', (postgresVersion) => {
  let container: StartedPostgreSqlContainer;

  beforeAll(async () => {
    container = await setupPostgresDatabase(
      `postgres:${postgresVersion}-alpine`
    );
  });

  afterAll(async () => {
    await container?.stop();
  });

  it('prints the package version', async () => {
    const result = await runCli(['--version']);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toBe(`${version}\n`);
  });

  it('runs .sql and .js migrations with up from another directory', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'pgm-e2e-smoke-'));
    try {
      await mkdir(join(cwd, 'migrations'));
      await writeFile(
        join(cwd, 'migrations', '001_sql-table.sql'),
        [
          '-- Up Migration',
          'CREATE TABLE smoke_sql (id integer PRIMARY KEY);',
          '',
          '-- Down Migration',
          'DROP TABLE smoke_sql;',
          '',
        ].join('\n')
      );
      await writeFile(
        join(cwd, 'migrations', '002_js-table.js'),
        [
          'export const up = (pgm) => {',
          "  pgm.createTable('smoke_js', { id: 'id' });",
          '};',
          '',
        ].join('\n')
      );

      const result = await runCli(['up'], {
        cwd,
        env: { DATABASE_URL: container.getConnectionUri() },
      });

      expect(result.code, result.stderr).toBe(0);
      await expect(
        psqlSelect(container, 'SELECT name FROM pgmigrations ORDER BY id')
      ).resolves.toEqual(['001_sql-table', '002_js-table']);
      await expect(
        psqlSelect(
          container,
          "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
        )
      ).resolves.toEqual(['pgmigrations', 'smoke_js', 'smoke_sql']);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('runs pg_dump in the container through pgDumpShim', async () => {
    const shim = await pgDumpShim(container);
    const fakeShim = await pgDumpShim(container, { reportVersion: '13.0' });

    expect(execFileSync(shim, ['--version'], { encoding: 'utf8' })).toMatch(
      new RegExp(String.raw`^pg_dump \(PostgreSQL\) ${postgresVersion}\.`)
    );
    expect(execFileSync(fakeShim, ['--version'], { encoding: 'utf8' })).toBe(
      'pg_dump (PostgreSQL) 13.0\n'
    );

    const dump = execFileSync(fakeShim, ['--schema-only'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PGUSER: container.getUsername(),
        PGPASSWORD: container.getPassword(),
        PGDATABASE: container.getDatabase(),
      },
    });
    expect(dump).toContain('PostgreSQL database dump');
  });

  it.runIf(process.env.PGM_E2E_COVERAGE)(
    'writes raw V8 coverage of the CLI',
    async () => {
      const before = await rawCoverageFiles();

      await runCli(['--version']);

      const added = (await rawCoverageFiles()).filter(
        (file) => !before.includes(file)
      );
      expect(added).toHaveLength(1);

      const { result } = JSON.parse(
        await readFile(join(RAW_COVERAGE_DIR, added[0]), 'utf8')
      ) as { result: Array<{ url: string }> };
      expect(
        result.filter(({ url }) => url.endsWith('/bin/node-pg-migrate.js'))
      ).toHaveLength(1);
    }
  );
});
