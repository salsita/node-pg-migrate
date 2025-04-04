import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { exec as processExec } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';
import type { ExpectStatic, TestContext } from 'vitest';
import { afterEach, beforeEach, describe, test } from 'vitest';

const exec = promisify(processExec);

const SNAPSHOT_FOLDER = '__snapshots__/postgres-it.spec.ts.snap.d/';

const IGNORE_LOG_PATTERNS = [
  // On some environments, it can happen that e.g. a NPM_TOKEN wants to be read for the .npmrc
  // and this is not relevant for the test
  /WARN.*Issue while reading .*\. Failed to replace env in config: /,
  // This is logged by `getNumericPrefix` which currently is used inside `.sort()` and this is unstable/non-deterministic
  /^Can't determine timestamp for \d{3}$/,
] as const;

const shouldRunIntegrationTests = process.env.INTEGRATION !== 'false';
describe.runIf(shouldRunIntegrationTests).each([[13], [14], [15], [16], [17]])(
  'Postgres %i Integration Test',
  { timeout: 20_000 },
  (postgresVersion) => {
    let container: StartedPostgreSqlContainer;

    beforeEach(async () => {
      container = await new PostgreSqlContainer(
        `postgres:${postgresVersion}-alpine`
      )
        .withUsername('ubuntu')
        .withPassword('ubuntu')
        .withDatabase('integration_test')
        .withExposedPorts(5432)
        .start();
    }, 30_000);

    afterEach(async () => {
      await container.stop();
    });

    async function execMigrate(options: {
      expect: ExpectStatic;
      task: TestContext['task'];
      direction: 'up' | 'down';
      env?: NodeJS.ProcessEnv;
    }): Promise<void> {
      const { expect, task, direction, env = {} } = options;

      const command =
        direction === 'up'
          ? 'node bin/node-pg-migrate.js up -m test/migrations'
          : 'node bin/node-pg-migrate.js down 0 -m test/migrations --timestamps';

      const execUp = await exec(command, { env });

      await expect(execUp.stdout).toMatchFileSnapshot(
        `${SNAPSHOT_FOLDER}${task.name}/${postgresVersion}-migrations-${direction}.log`
      );

      await expect(
        execUp.stderr
          .split('\n')
          .filter(
            (line) => !IGNORE_LOG_PATTERNS.some((pattern) => pattern.test(line))
          )
          .join('\n')
      ).toMatchFileSnapshot(
        `${SNAPSHOT_FOLDER}${task.name}/${postgresVersion}-migrations-${direction}.error.log`
      );
    }

    test.concurrent('Default', async ({ expect, task }) => {
      const env: NodeJS.ProcessEnv = {
        DATABASE_URL: container.getConnectionUri(),
      };

      await execMigrate({ expect, task, direction: 'up', env });
      await execMigrate({ expect, task, direction: 'down', env });
    });

    test('Config-1', async ({ expect, task, onTestFinished }) => {
      // TODO @Shinigami92 2025-04-04: Replace with https://vitest.dev/guide/mocking.html#file-system
      mkdirSync('config');
      writeFileSync(
        'config/default.json',
        JSON.stringify(
          {
            db: {
              user: container.getUsername(),
              password: container.getPassword(),
              host: container.getHost(),
              port: container.getMappedPort(5432),
              database: container.getDatabase(),
            },
          },
          null,
          2
        )
      );

      onTestFinished(() => {
        rmSync('config', { recursive: true, force: true });
      });

      await execMigrate({ expect, task, direction: 'up' });
      await execMigrate({ expect, task, direction: 'down' });
    });

    test('Config-2', async ({ expect, task, onTestFinished }) => {
      // TODO @Shinigami92 2025-04-04: Replace with https://vitest.dev/guide/mocking.html#file-system
      mkdirSync('config');
      writeFileSync(
        'config/default.json',
        JSON.stringify(
          {
            db: {
              url: {
                connectionString: container.getConnectionUri(),
              },
            },
          },
          null,
          2
        )
      );

      onTestFinished(() => {
        rmSync('config', { recursive: true, force: true });
      });

      await execMigrate({ expect, task, direction: 'up' });
      await execMigrate({ expect, task, direction: 'down' });
    });

    test('Dotenv', async ({ expect, task, onTestFinished }) => {
      // TODO @Shinigami92 2025-04-04: Replace with https://vitest.dev/guide/mocking.html#file-system
      writeFileSync('.env', `DATABASE_URL=${container.getConnectionUri()}`);

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
        `POSTGRES_USER=${container.getUsername()}
POSTGRES_PASSWORD=${container.getPassword()}
POSTGRES_DB=${container.getDatabase()}
DATABASE_URL=postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@${container.getHost()}:${container.getMappedPort(5432)}/$POSTGRES_DB
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
