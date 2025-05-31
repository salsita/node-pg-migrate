import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCli } from '../src';

const CONFIG_JSON = {
  user: 'postgres',
  password: 'password',
  host: 'localhost',
  port: 5432,
  database: 'pgmigrationz',
};

// Mock the pg Client so it never connects
vi.mock('pg', () => {
  const mockPg = {
    Client: class {
      connect = vi.fn().mockResolvedValue(null);
      end = vi.fn().mockResolvedValue(null);
      query = vi.fn().mockResolvedValue({ rows: [] });
    },
  };
  return {
    ...mockPg,
    default: mockPg,
  };
});

describe('node-pg-migrate config file and env fallback', () => {
  let configFile: string;

  afterEach(() => {
    if (configFile) {
      try {
        unlinkSync(configFile);
      } catch {
        /* ignore */
      }
    }

    vi.unstubAllEnvs();
  });

  it('fails when no config file or env vars are provided', async () => {
    const code = await runCli(['up', '--dry-run'], {});
    expect(code).toBe(1);
  });

  it('fails with config file missing DB connection', async () => {
    configFile = join(tmpdir(), `test-config-${Date.now()}.json`);
    writeFileSync(configFile, JSON.stringify({}));
    const code = await runCli(
      ['up', '--dry-run', '--config-file', configFile],
      {}
    );
    expect(code).toBe(1);
  });

  it('succeeds with valid config file containing user, database, etc', async () => {
    configFile = join(tmpdir(), `test-config-${Date.now()}.json`);
    writeFileSync(configFile, JSON.stringify(CONFIG_JSON));
    const code = await runCli(
      ['up', '--dry-run', '--config-file', configFile],
      {}
    );
    expect(code).toBe(0);
  });
  it('succeeds with DATABASE_URL env var', async () => {
    const code = await runCli(['up', '--dry-run'], {
      DATABASE_URL: 'postgres://myuser:mypassword@localhost:5432/mydb',
    });
    expect(code).toBe(0);
  });

  it('succeeds with PGHOST, PGUSER, PGDATABASE env vars', async () => {
    const code = await runCli(['up', '--dry-run'], {
      DATABASE_URL: '',
      PGHOST: 'localhost',
      PGUSER: 'user',
      PGDATABASE: 'db',
      PGPASSWORD: 'pass',
      PGPORT: '5432',
    });
    expect(code).toBe(0);
  });
});
