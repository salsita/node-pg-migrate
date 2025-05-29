import { spawnSync } from 'node:child_process';
import { unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const BIN_PATH = resolve(__dirname, '../bin/node-pg-migrate.js');

const CONFIG_JSON = {
  user: 'postgres',
  password: 'password',
  host: 'localhost',
  port: 5432,
  database: 'pgmigrations',
};

const ERROR_MESSAGE =
  'environment variable is not set or incomplete connection parameters are provided';

describe('node-pg-migrate config file and env fallback', () => {
  const configFile = resolve(__dirname, 'test-config.json');

  afterEach(() => {
    try {
      unlinkSync(configFile);
    } catch {
      // Ignore if the file does not exist
    }

    vi.unstubAllEnvs();
  });

  it('fails when no config file or env vars are provided', () => {
    const result = spawnSync('node', [BIN_PATH, 'up', '--dry-run'], {
      env: {},
      encoding: 'utf8',
    });
    const errorOutput = result.stderr || result.stdout || '';
    expect(errorOutput).toContain(ERROR_MESSAGE);
    expect(result.status).toBe(1);
  });

  it('fails with config file missing DB connection', () => {
    writeFileSync(configFile, JSON.stringify({}), 'utf8');
    const result = spawnSync(
      'node',
      [BIN_PATH, 'up', '--dry-run', '--config-file', configFile],
      {
        env: { ...process.env, DATABASE_URL: '' },
        encoding: 'utf8',
      }
    );
    expect(result.stderr).toContain(ERROR_MESSAGE);
    expect(result.status).toBe(1);
  });

  it('succeeds with valid config file containing user, database, etc', () => {
    writeFileSync(configFile, JSON.stringify(CONFIG_JSON), 'utf8');
    const result = spawnSync(
      'node',
      [BIN_PATH, 'up', '--dry-run', '--config-file', configFile],
      {
        env: { ...process.env, DATABASE_URL: '' },
        encoding: 'utf8',
      }
    );
    expect(result.stderr).not.toContain(ERROR_MESSAGE);
  });

  it('succeeds with DATABASE_URL env var', () => {
    const result = spawnSync('node', [BIN_PATH, 'up', '--dry-run'], {
      env: {
        ...process.env,
        DATABASE_URL: 'postgres://myuser:mypassword@localhost:5432/mydb',
      },
      encoding: 'utf8',
    });
    expect(result.stderr).not.toContain(ERROR_MESSAGE);
  });

  it('succeeds with PGHOST, PGUSER, PGDATABASE env vars', () => {
    const result = spawnSync('node', [BIN_PATH, 'up', '--dry-run'], {
      env: {
        ...process.env,
        DATABASE_URL: '',
        PGHOST: 'localhost',
        PGUSER: 'user',
        PGDATABASE: 'db',
        PGPASSWORD: 'pass',
        PGPORT: '5432',
      },
      encoding: 'utf8',
    });
    expect(result.stderr).not.toContain(ERROR_MESSAGE);
  });
});
