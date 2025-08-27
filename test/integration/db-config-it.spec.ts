import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { ExpectStatic } from 'vitest';
import { afterAll, afterEach, beforeAll, describe, it, vi } from 'vitest';
import {
  cleanupDatabase,
  exec,
  filterIgnoredLines,
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

const ERROR_MESSAGE =
  'environment variable is not set or incomplete connection parameters are provided';

const SNAPSHOT_FOLDER = '__snapshots__/db-config-it.spec.ts.snap.d/';

describe.each(PG_VERSIONS)(
  'node-pg-migrate config file and env fallback (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (postgresVersion) => {
    let pgContainer: StartedPostgreSqlContainer;
    //TODO @brenoepics 2025-07-22: Replace with https://vitest.dev/guide/mocking.html#file-system
    function configFile(taskName: string): string {
      return resolve(
        tmpdir(),
        `${postgresVersion}-${taskName.replace(/[^a-zA-Z0-9_-]/g, '_')}-config.json`
      );
    }

    beforeAll(async () => {
      const containerImage = `postgres:${postgresVersion}-alpine`;
      pgContainer = await setupPostgresDatabase(
        containerImage,
        `test_migrations_pg_${postgresVersion}`
      );
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      if (pgContainer) {
        await pgContainer.stop();
      }
    });

    afterEach(async (context) => {
      try {
        await cleanupDatabase(pgContainer);
        unlinkSync(configFile(context.task.name));
      } catch {
        // Ignore if the file does not exist
      }

      vi.unstubAllEnvs();
    });

    function getCommand({
      direction,
      configFile,
      configValue,
      envPath,
    }: {
      direction: 'up' | 'down';
      configFile?: string;
      configValue?: string;
      envPath?: string;
    }): string {
      let command = 'node bin/node-pg-migrate.js';
      if (direction === 'up') {
        command += ' up -m test/migrations';
      } else {
        command += ' down 0 -m test/migrations --timestamps';
      }

      if (configFile) {
        command += ` --config-file ${configFile}`;
      }

      if (configValue) {
        command += ` --config-value ${configValue}`;
      }

      if (envPath) {
        command += ` --envPath ${envPath}`;
      }

      return command;
    }

    async function execMigrate(options: {
      expect: ExpectStatic;
      direction: 'up' | 'down';
      env?: NodeJS.ProcessEnv;
      configFile?: string;
      envPath?: string;
      configValue?: string;
    }): Promise<{ stdout: string; stderr: string }> {
      const { expect, direction, env = {} } = options;
      const command = getCommand({
        direction: direction,
        configFile: options.configFile,
        configValue: options.configValue,
        envPath: options.envPath,
      });

      const execUp = await exec(command, { env });

      const stderrSnapshot = `${SNAPSHOT_FOLDER}/migrations-${direction}.stderr.log`;
      await expect(filterIgnoredLines(execUp.stderr)).toMatchFileSnapshot(
        stderrSnapshot
      );

      const stdoutSnapshot = `${SNAPSHOT_FOLDER}/migrations-${direction}.pg-${postgresVersion}.stdout.log`;
      await expect(filterIgnoredLines(execUp.stdout)).toMatchFileSnapshot(
        stdoutSnapshot
      );

      return execUp;
    }

    it.concurrent(
      'fails when no config file or env vars are provided',
      async ({ expect }) => {
        let execUp: { stdout?: string; stderr?: string };
        let execDown: { stdout?: string; stderr?: string };

        try {
          execUp = await execMigrate({
            expect,
            direction: 'up',
            env: { ...process.env, DATABASE_URL: '' },
          });
        } catch (error) {
          execUp = error as { stdout?: string; stderr?: string };
        }

        try {
          execDown = await execMigrate({
            expect,
            direction: 'down',
            env: { ...process.env, DATABASE_URL: '' },
          });
        } catch (error) {
          execDown = error as { stdout?: string; stderr?: string };
        }

        expect(execUp.stderr).toContain(ERROR_MESSAGE);
        expect(execDown.stderr).toContain(ERROR_MESSAGE);
      }
    );

    it.concurrent(
      'fails with config file missing DB connection',
      async ({ expect, task }) => {
        const file = configFile(task.name);
        writeFileSync(file, JSON.stringify({}), 'utf8');

        let execUp: { stdout?: string; stderr?: string };
        let execDown: { stdout?: string; stderr?: string };

        try {
          execUp = await execMigrate({
            expect,
            direction: 'up',
            configFile: file,
            env: { ...process.env, DATABASE_URL: '' },
          });
        } catch (error) {
          execUp = error as { stdout?: string; stderr?: string };
        }

        try {
          execDown = await execMigrate({
            expect,
            direction: 'down',
            configFile: file,
            env: { ...process.env, DATABASE_URL: '' },
          });
        } catch (error) {
          execDown = error as { stdout?: string; stderr?: string };
        }

        expect(execUp.stderr).toContain(ERROR_MESSAGE);
        expect(execDown.stderr).toContain(ERROR_MESSAGE);
      }
    );

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

      const execUp = await execMigrate({
        expect,
        direction: 'up',
        configFile: file,
        env: { ...process.env, DATABASE_URL: '' },
      });
      const execDown = await execMigrate({
        expect,
        direction: 'down',
        configFile: file,
        env: { ...process.env, DATABASE_URL: '' },
      });

      expect(execUp.stdout).not.toContain(ERROR_MESSAGE);
      expect(execDown.stdout).not.toContain(ERROR_MESSAGE);
    });

    it('succeeds with DATABASE_URL env var', async ({ expect }) => {
      const execUp = await execMigrate({
        expect,
        direction: 'up',
        env: { ...process.env, DATABASE_URL: pgContainer.getConnectionUri() },
      });
      const execDown = await execMigrate({
        expect,
        direction: 'down',
        env: { ...process.env, DATABASE_URL: pgContainer.getConnectionUri() },
      });

      expect(execUp.stdout).not.toContain(ERROR_MESSAGE);
      expect(execDown.stdout).not.toContain(ERROR_MESSAGE);
    });

    it('succeeds with PGHOST, PGUSER, PGDATABASE env vars', async ({
      expect,
    }) => {
      const env = {
        ...process.env,
        DATABASE_URL: '',
        PGHOST: pgContainer.getHost(),
        PGUSER: pgContainer.getUsername(),
        PGDATABASE: pgContainer.getDatabase(),
        PGPASSWORD: pgContainer.getPassword(),
        PGPORT: pgContainer.getPort().toString(),
      };
      const execUp = await execMigrate({
        expect,
        direction: 'up',
        env: env,
      });
      const execDown = await execMigrate({
        expect,
        direction: 'down',
        env: env,
      });

      expect(execUp.stdout).not.toContain(ERROR_MESSAGE);
      expect(execDown.stdout).not.toContain(ERROR_MESSAGE);
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

      const execUp = await execMigrate({
        expect,
        direction: 'up',
        configFile: file,
        configValue: 'dev',
        env: { ...process.env, DATABASE_URL: '' },
      });
      const execDown = await execMigrate({
        expect,
        direction: 'down',
        configFile: file,
        configValue: 'dev',
        env: { ...process.env, DATABASE_URL: '' },
      });

      expect(execUp.stdout).not.toContain(ERROR_MESSAGE);
      expect(execDown.stdout).not.toContain(ERROR_MESSAGE);
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

      const execUp = await execMigrate({
        expect,
        direction: 'up',
        configFile: file,
        configValue: 'test',
        env: { ...process.env, DATABASE_URL: '' },
      });
      const execDown = await execMigrate({
        expect,
        direction: 'down',
        configFile: file,
        configValue: 'test',
        env: { ...process.env, DATABASE_URL: '' },
      });

      expect(execUp.stdout).not.toContain(ERROR_MESSAGE);
      expect(execDown.stdout).not.toContain(ERROR_MESSAGE);
    });

    it('succeeds with JavaScript config file using ES6 exports', async ({
      expect,
      task,
    }) => {
      const file = resolve(
        tmpdir(),
        `${postgresVersion}-${task.name.replace(/[^a-zA-Z0-9_-]/g, '_')}-config.js`
      );
      const configContent = `export default {
  host: '${pgContainer.getHost()}',
  port: ${pgContainer.getPort()},
  database: '${pgContainer.getDatabase()}',
  user: '${pgContainer.getUsername()}',
  password: '${pgContainer.getPassword()}'
};`;
      writeFileSync(file, configContent, 'utf8');

      const execUp = await execMigrate({
        expect,
        direction: 'up',
        configFile: file,
        env: { ...process.env, DATABASE_URL: '' },
      });
      const execDown = await execMigrate({
        expect,
        direction: 'down',
        configFile: file,
        env: { ...process.env, DATABASE_URL: '' },
      });

      expect(execUp.stdout).not.toContain(ERROR_MESSAGE);
      expect(execDown.stdout).not.toContain(ERROR_MESSAGE);

      try {
        unlinkSync(file);
      } catch {
        // Ignore if file doesn't exist
      }
    });

    it('succeeds with TypeScript config file', async ({ expect, task }) => {
      const file = resolve(
        tmpdir(),
        `${postgresVersion}-${task.name.replace(/[^a-zA-Z0-9_-]/g, '_')}-config.ts`
      );
      const configContent = `interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

const config: DatabaseConfig = {
  host: '${pgContainer.getHost()}',
  port: ${pgContainer.getPort()},
  database: '${pgContainer.getDatabase()}',
  user: '${pgContainer.getUsername()}',
  password: '${pgContainer.getPassword()}'
};

export default config;`;
      writeFileSync(file, configContent, 'utf8');

      const execUp = await execMigrate({
        expect,
        direction: 'up',
        configFile: file,
        env: { ...process.env, DATABASE_URL: '' },
      });
      const execDown = await execMigrate({
        expect,
        direction: 'down',
        configFile: file,
        env: { ...process.env, DATABASE_URL: '' },
      });

      expect(execUp.stdout).not.toContain(ERROR_MESSAGE);
      expect(execDown.stdout).not.toContain(ERROR_MESSAGE);

      try {
        unlinkSync(file);
      } catch {
        // Ignore if file doesn't exist
      }
    });

    it('succeeds with JavaScript config file using module.exports', async ({
      expect,
      task,
    }) => {
      const file = resolve(
        tmpdir(),
        `${postgresVersion}-${task.name.replace(/[^a-zA-Z0-9_-]/g, '_')}-config.js`
      );
      const configContent = `module.exports = {
  host: '${pgContainer.getHost()}',
  port: ${pgContainer.getPort()},
  database: '${pgContainer.getDatabase()}',
  user: '${pgContainer.getUsername()}',
  password: '${pgContainer.getPassword()}'
};`;
      writeFileSync(file, configContent, 'utf8');

      const execUp = await execMigrate({
        expect,
        direction: 'up',
        configFile: file,
        env: { ...process.env, DATABASE_URL: '' },
      });
      const execDown = await execMigrate({
        expect,
        direction: 'down',
        configFile: file,
        env: { ...process.env, DATABASE_URL: '' },
      });

      expect(execUp.stdout).not.toContain(ERROR_MESSAGE);
      expect(execDown.stdout).not.toContain(ERROR_MESSAGE);

      try {
        unlinkSync(file);
      } catch {
        // Ignore if file doesn't exist
      }
    });

    it('succeeds with TypeScript config file with nested environments and config-value', async ({
      expect,
      task,
    }) => {
      const file = resolve(
        tmpdir(),
        `${postgresVersion}-${task.name.replace(/[^a-zA-Z0-9_-]/g, '_')}-config.ts`
      );
      const configContent = `interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

interface EnvironmentConfig {
  development: DatabaseConfig;
  test: DatabaseConfig;
  production: DatabaseConfig;
}

const config: EnvironmentConfig = {
  development: {
    host: '${pgContainer.getHost()}',
    port: ${pgContainer.getPort()},
    database: '${pgContainer.getDatabase()}',
    user: '${pgContainer.getUsername()}',
    password: '${pgContainer.getPassword()}'
  },
  test: {
    host: '${pgContainer.getHost()}',
    port: ${pgContainer.getPort()},
    database: '${pgContainer.getDatabase()}',
    user: '${pgContainer.getUsername()}',
    password: '${pgContainer.getPassword()}'
  },
  production: {
    host: 'localhost',
    port: 5432,
    database: 'prod_db',
    user: 'prod_user',
    password: 'prod_pass'
  }
};

export default config;`;
      writeFileSync(file, configContent, 'utf8');

      const execUp = await execMigrate({
        expect,
        direction: 'up',
        configFile: file,
        configValue: 'development',
        env: { ...process.env, DATABASE_URL: '' },
      });
      const execDown = await execMigrate({
        expect,
        direction: 'down',
        configFile: file,
        configValue: 'development',
        env: { ...process.env, DATABASE_URL: '' },
      });

      expect(execUp.stdout).not.toContain(ERROR_MESSAGE);
      expect(execDown.stdout).not.toContain(ERROR_MESSAGE);

      try {
        unlinkSync(file);
      } catch {
        // Ignore if file doesn't exist
      }
    });
  }
);
