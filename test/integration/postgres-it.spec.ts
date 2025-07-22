import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  type ExpectStatic,
  test,
  type TestContext,
  vi,
} from 'vitest';
import {
  cleanupDatabase,
  exec,
  filterIgnoredLines,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

const SNAPSHOT_FOLDER = '__snapshots__/postgres-it.spec.ts.snap.d/';

describe.each(PG_VERSIONS)(
  'Postgres Integration Test (PG %s)',
  (postgresVersion) => {
    let pgContainer: StartedPostgreSqlContainer;
    const configFile = (taskName: string) =>
      resolve(
        import.meta.dirname,
        `${postgresVersion}-${taskName.replace(/[^a-zA-Z0-9_-]/g, '_')}-config.json`
      );

    beforeAll(async () => {
      const containerImage = `postgres:${postgresVersion}-alpine`;
      pgContainer = await setupPostgresDatabase(
        containerImage,
        'test_migrations'
      );
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
        command += ' up -m test/migrations';
      } else {
        command += ' down 0 -m test/migrations --timestamps';
      }

      if (configFile) {
        command += ` --config-file ${configFile}`;
      }

      return command;
    }

    async function execMigrate(options: {
      expect: ExpectStatic;
      task: TestContext['task'];
      direction: 'up' | 'down';
      env?: NodeJS.ProcessEnv;
      configFile?: string;
    }): Promise<void> {
      const { expect, task, direction, env = {} } = options;
      const command = getCommand(direction, options.configFile);

      const execUp = await exec(command, { env });

      const snapshot = `${SNAPSHOT_FOLDER}${task.name}/${postgresVersion}-migrations-${direction}.error.log`;
      await expect(filterIgnoredLines(execUp.stdout)).toMatchFileSnapshot(
        snapshot
      );
    }

    test('Default', async ({ expect, task }) => {
      const env: NodeJS.ProcessEnv = {
        DATABASE_URL: pgContainer.getConnectionUri(),
      };

      await execMigrate({ expect, task, direction: 'up', env });
      await execMigrate({ expect, task, direction: 'down', env });
    });

    test('Config-1', async ({ expect, task }) => {
      const CONFIG_JSON = {
        db: {
          user: pgContainer.getUsername(),
          password: pgContainer.getPassword(),
          host: pgContainer.getHost(),
          port: pgContainer.getPort(),
          database: pgContainer.getDatabase(),
        },
      };

      const file = configFile(task.name);
      writeFileSync(file, JSON.stringify(CONFIG_JSON, null, 2), 'utf8');

      await execMigrate({
        expect,
        task,
        direction: 'up',
        configFile: file,
      });
      await execMigrate({
        expect,
        task,
        direction: 'down',
        configFile: file,
      });
    });

    test('Config-2', async ({ expect, task }) => {
      const CONFIG_JSON = {
        db: {
          url: pgContainer.getConnectionUri(),
        },
      };
      const file = configFile(task.name);
      writeFileSync(file, JSON.stringify(CONFIG_JSON, null, 2), 'utf8');

      await execMigrate({
        expect,
        task,
        direction: 'up',
        configFile: file,
      });
      await execMigrate({
        expect,
        task,
        direction: 'down',
        configFile: file,
      });
    });

    test('Dotenv', async ({ expect, task, onTestFinished }) => {
      // TODO @Shinigami92 2025-04-04: Replace with https://vitest.dev/guide/mocking.html#file-system
      writeFileSync('.env', `DATABASE_URL=${pgContainer.getConnectionUri()}`);

      onTestFinished(() => {
        rmSync('.env', { force: true });
      });

      await execMigrate({ expect, task, direction: 'up' });
      await execMigrate({ expect, task, direction: 'down' });
    });

    test('Dotenv-Expand', async ({ expect, task, onTestFinished }) => {
      // TODO @Shinigami92 2025-04-04: Replace with https://vitest.dev/guide/mocking.html#file-system
      writeFileSync(
        '.env',
        `POSTGRES_USER=${pgContainer.getUsername()}
POSTGRES_PASSWORD=${pgContainer.getPassword()}
POSTGRES_DB=${pgContainer.getDatabase()}
DATABASE_URL=postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@${pgContainer.getHost()}:${pgContainer.getPort()}/$POSTGRES_DB
`
      );

      onTestFinished(() => {
        rmSync('.env', { force: true });
      });

      await execMigrate({ expect, task, direction: 'up' });
      await execMigrate({ expect, task, direction: 'down' });
    });
  }
);
