import type { ClientBase } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { runner } from '../src';

type ExecutedMigrations = Array<{ id: number; name: string; run_on: Date }>;

function mockMigrationClient(
  getExecutedMigrations: () => ExecutedMigrations
): ClientBase {
  let id = 1;
  return {
    query: vi.fn((query) => {
      switch (query) {
        case 'SELECT pg_try_advisory_lock(7241865325823964) AS "lockObtained"': {
          return Promise.resolve({
            rows: [{ lockObtained: true }], // lock obtained
          });
        }

        case "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pgmigrations'": {
          return Promise.resolve({
            rows: [{}], // empty migrations table
          });
        }

        case 'CREATE TABLE "public"."pgmigrations" ( id SERIAL PRIMARY KEY, name varchar(255) NOT NULL, run_on timestamp NOT NULL)': {
          return Promise.resolve([{}]); // migration table created
        }

        case 'SELECT name FROM "public"."pgmigrations" ORDER BY run_on, id': {
          return Promise.resolve({
            rows: getExecutedMigrations(),
          });
        }

        case 'BEGIN;': {
          return Promise.resolve({}); // transaction started
        }

        case 'COMMIT;': {
          return Promise.resolve({}); // transaction committed
        }

        default: {
          if (
            query.startsWith(
              'INSERT INTO "public"."pgmigrations" (name, run_on) VALUES'
            )
          ) {
            const name: string =
              /VALUES \('([^']+)'/.exec(query as string)?.[1] ?? 'failed'; // migration name

            // insert migration
            getExecutedMigrations().push({
              name,
              run_on: new Date(
                +new Date('2024-01-01T00:00:00Z') +
                  (id - 1) * (24 * 60 * 60 * 1000)
              ),
              id: id++,
            });

            return Promise.resolve({}); // migration inserted
          }

          if (
            query.startsWith('DELETE FROM "public"."pgmigrations" WHERE name=')
          ) {
            const name = /WHERE name='([^']+)'/.exec(query as string)?.[1];
            const migrations = getExecutedMigrations();
            const index = migrations.findIndex((m) => m.name === name);
            if (index === -1) throw new Error(`migration not found: ${name}`);
            migrations.splice(index, 1);
            return Promise.resolve({}); // migration inserted
          }
        }
      }

      // bypass migration queries
      return Promise.resolve({ rows: [{}] });
    }),
  } as unknown as ClientBase;
}

describe('runner', () => {
  it('should return a function', () => {
    expect(runner).toBeTypeOf('function');
  });

  it('should throw an error when not options passed', () => {
    expect(
      // @ts-expect-error: runner needs options
      runner()
    ).rejects.toThrow(
      new Error(
        "Cannot destructure property 'log' of 'options' as it is undefined."
      )
    );
  });

  it.todo(
    'should throw an error when no databaseUrl or dbClient passed',
    () => {
      expect(
        // @ts-expect-error: runner needs options
        runner({ log: console.log })
      ).rejects.toThrow(
        new Error('You must provide either a databaseUrl or a dbClient')
      );
    }
  );

  it('should execute a basic up migration', async () => {
    const executedMigrations: ExecutedMigrations = [];

    const dbClient = mockMigrationClient(() => executedMigrations);

    await expect(
      runner({
        dbClient,
        migrationsTable: 'pgmigrations',
        // We use cockroach migrations for now, as they are more simple
        // We either could mock the migration files later or define specific migrations for unit-testing
        dir: 'test/cockroach',
        direction: 'up',
      })
    ).resolves.not.toThrow();
    expect(executedMigrations).toHaveLength(12);
    expect(executedMigrations).toMatchSnapshot();
  });

  it('should execute a basic down migration', async () => {
    const executedMigrations: ExecutedMigrations = [
      { id: 1, name: '004_table', run_on: new Date() },
      { id: 2, name: '006_table_rename', run_on: new Date() },
    ];

    const dbClient = mockMigrationClient(() => executedMigrations);

    await expect(
      runner({
        dbClient,
        migrationsTable: 'pgmigrations',
        // We use cockroach migrations for now, as they are more simple
        // We either could mock the migration files later or define specific migrations for unit-testing
        dir: 'test/cockroach',
        direction: 'down',
        count: 2,
      })
    ).resolves.not.toThrow();
    expect(executedMigrations).toHaveLength(0);
    expect(executedMigrations).toMatchSnapshot();
  });

  it('should execute a basic up migration in nested directories', async () => {
    const executedMigrations: ExecutedMigrations = [];

    const dbClient = mockMigrationClient(() => executedMigrations);

    await expect(
      runner({
        dbClient,
        migrationsTable: 'pgmigrations',
        // We use cockroach migrations for now, as they are more simple
        // We either could mock the migration files later or define specific migrations for unit-testing
        dir: 'test/migrations-subdir',
        direction: 'up',
      })
    ).resolves.not.toThrow();
    expect(executedMigrations).toHaveLength(4);
    expect(executedMigrations).toMatchSnapshot();
  });
});
