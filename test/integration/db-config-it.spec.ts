import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, it, vi } from 'vitest';
import {
  cleanupDatabase,
  exec,
  filterIgnoredLines,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

const ERROR_MESSAGE =
  'environment variable is not set or incomplete connection parameters are provided';

const SNAPSHOT_FOLDER = '__snapshots__/db-config-it.spec.ts.snap.d/';

describe.each(PG_VERSIONS)(
  'node-pg-migrate config file and env fallback (PG %s)',
  (postgresVersion) => {
    let pgContainer: StartedPostgreSqlContainer;
    const configFile = (taskName: string) =>
      resolve(
        import.meta.dirname,
        `${postgresVersion}-${taskName.replace(/[^a-zA-Z0-9_-]/g, '_')}-config.json`
      );

    beforeAll(async () => {
      const containerImage = `postgres:${postgresVersion}-alpine`;
      pgContainer = await setupPostgresDatabase(containerImage, 'test_config');
      await pgContainer.snapshot('clean_state');
    });

    afterAll(async () => {
      await pgContainer.stop();
    });

    afterEach(async (context) => {
      try {
        await cleanupDatabase(pgContainer.getConnectionUri());
        await pgContainer.restoreSnapshot('clean_state');
        unlinkSync(configFile(context.task.name));
      } catch {
        // Ignore if the file does not exist
      }

      vi.unstubAllEnvs();
    });

    function getCommand(direction: 'up' | 'down', configFile?: string): string {
      let command = 'node bin/node-pg-migrate.js';
      if (direction === 'up') {
        command += ' up -m test/ts/migrations';
      } else {
        command += ' down -m test/ts/migrations 0 --timestamps';
      }

      if (configFile) {
        command += ` --config-file ${configFile}`;
      }

      return command;
    }

    it('fails when no config file or env vars are provided', async ({
      expect,
      task,
    }) => {
      const direction = 'up';
      let execUp: { stdout?: string; stderr?: string } = {};

      try {
        await exec(getCommand(direction));
      } catch (error: unknown) {
        if (typeof error === 'object' && error !== null) {
          execUp = error as { stdout?: string; stderr?: string };
        }
      }

      const errorOutput = execUp.stderr || '';
      expect(errorOutput).toContain(ERROR_MESSAGE);

      const snapshot = `${SNAPSHOT_FOLDER}${task.name}/${postgresVersion}-migrations-${direction}.error.log`;
      await expect(filterIgnoredLines(execUp.stderr || '')).toMatchFileSnapshot(
        snapshot
      );
    });

    it('fails with config file missing DB connection', async ({
      expect,
      task,
    }) => {
      const file = configFile(task.name);
      writeFileSync(file, JSON.stringify({}), 'utf8');
      const direction = 'up';
      let execUp: { stdout?: string; stderr?: string } = {};

      try {
        await exec(getCommand(direction, file), {
          env: { ...process.env, DATABASE_URL: '' },
        });
      } catch (error: unknown) {
        if (typeof error === 'object' && error !== null) {
          execUp = error as { stdout?: string; stderr?: string };
        }
      }

      const errorOutput = execUp.stderr || '';
      expect(errorOutput).toContain(ERROR_MESSAGE);

      const snapshot = `${SNAPSHOT_FOLDER}${task.name}/${postgresVersion}-migrations-${direction}.error.log`;
      await expect(filterIgnoredLines(execUp.stderr || '')).toMatchFileSnapshot(
        snapshot
      );
    });

    it('succeeds with valid config file containing user, database, etc', async ({
      expect,
      task,
    }) => {
      const file = configFile(task.name);
      writeFileSync(
        file,
        JSON.stringify({
          user: pgContainer.getUsername(),
          password: pgContainer.getPassword(),
          host: pgContainer.getHost(),
          port: pgContainer.getPort(),
          database: pgContainer.getDatabase(),
        }),
        'utf8'
      );

      const direction = 'up';
      const execUp = await exec(getCommand(direction, file), {
        env: { ...process.env, DATABASE_URL: '' },
      });

      const output = execUp.stdout || '';
      expect(output).not.toContain(ERROR_MESSAGE);

      const snapshot = `${SNAPSHOT_FOLDER}${task.name}/${postgresVersion}-migrations-${direction}.log`;
      await expect(filterIgnoredLines(execUp.stdout)).toMatchFileSnapshot(
        snapshot
      );
    });

    it('succeeds with DATABASE_URL env var', async ({ expect, task }) => {
      const direction = 'up';
      const execUp = await exec(getCommand(direction), {
        env: { ...process.env, DATABASE_URL: pgContainer.getConnectionUri() },
      });

      const output = execUp.stdout || '';
      expect(output).not.toContain(ERROR_MESSAGE);

      const snapshot = `${SNAPSHOT_FOLDER}${task.name}/${postgresVersion}-migrations-${direction}.log`;
      await expect(filterIgnoredLines(execUp.stdout)).toMatchFileSnapshot(
        snapshot
      );
    });

    it('succeeds with PGHOST, PGUSER, PGDATABASE env vars', async ({
      expect,
      task,
    }) => {
      const direction = 'up';
      const execUp = await exec(getCommand(direction), {
        env: {
          ...process.env,
          DATABASE_URL: '',
          PGHOST: pgContainer.getHost(),
          PGUSER: pgContainer.getUsername(),
          PGDATABASE: pgContainer.getDatabase(),
          PGPASSWORD: pgContainer.getPassword(),
          PGPORT: pgContainer.getPort().toString(),
        },
      });

      const output = execUp.stdout || '';
      expect(output).not.toContain(ERROR_MESSAGE);

      const snapshot = `${SNAPSHOT_FOLDER}${task.name}/${postgresVersion}-migrations-${direction}.log`;
      await expect(filterIgnoredLines(execUp.stdout)).toMatchFileSnapshot(
        snapshot
      );
    });

    it('succeeds with config-value "dev"', async ({ expect, task }) => {
      const CONFIG_MULTI_USER_JSON = {
        dev: {
          user: pgContainer.getUsername(),
          password: pgContainer.getPassword(),
          host: pgContainer.getHost(),
          port: pgContainer.getPort(),
          database: pgContainer.getDatabase(),
        },
        test: {
          user: pgContainer.getUsername(),
          password: pgContainer.getPassword(),
          host: pgContainer.getHost(),
          port: pgContainer.getPort(),
          database: pgContainer.getDatabase(),
        },
      };
      const file = configFile(task.name);
      writeFileSync(file, JSON.stringify(CONFIG_MULTI_USER_JSON), 'utf8');
      const direction = 'up';
      const command = `${getCommand(direction, file)} --config-value dev`;
      const execUp = await exec(command, {
        env: { ...process.env, DATABASE_URL: '' },
      });

      const output = execUp.stdout || '';
      expect(output).not.toContain(ERROR_MESSAGE);

      const snapshot = `${SNAPSHOT_FOLDER}${task.name}/${postgresVersion}-migrations-${direction}.log`;
      await expect(filterIgnoredLines(execUp.stdout)).toMatchFileSnapshot(
        snapshot
      );
    });

    it('succeeds with config-value "test"', async ({ expect, task }) => {
      const CONFIG_MULTI_USER_JSON = {
        dev: {
          user: pgContainer.getUsername(),
          password: pgContainer.getPassword(),
          host: pgContainer.getHost(),
          port: pgContainer.getPort(),
          database: pgContainer.getDatabase(),
        },
        test: {
          user: pgContainer.getUsername(),
          password: pgContainer.getPassword(),
          host: pgContainer.getHost(),
          port: pgContainer.getPort(),
          database: pgContainer.getDatabase(),
        },
      };
      const file = configFile(task.name);
      writeFileSync(file, JSON.stringify(CONFIG_MULTI_USER_JSON), 'utf8');
      const direction = 'up';
      const command = `${getCommand(direction, file)} --config-value test`;
      const execUp = await exec(command, {
        env: { ...process.env, DATABASE_URL: '' },
      });

      const output = execUp.stdout || '';
      expect(output).not.toContain(ERROR_MESSAGE);

      const snapshot = `${SNAPSHOT_FOLDER}${task.name}/${postgresVersion}-migrations-${direction}.log`;
      await expect(filterIgnoredLines(execUp.stdout)).toMatchFileSnapshot(
        snapshot
      );
    });
  }
);
