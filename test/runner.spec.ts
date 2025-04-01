import type { ClientBase } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { runner } from '../src';

describe('runner', () => {
  it('should return a function', () => {
    expect(runner).toBeTypeOf('function');
  });

  it('should throw an error when not options passed', async () => {
    await expect(
      // @ts-expect-error: runner needs options
      runner()
    ).rejects.toThrow(
      new TypeError(
        "Cannot destructure property 'log' of 'options' as it is undefined."
      )
    );
  });

  it('should throw an error when no databaseUrl or dbClient passed', async () => {
    await expect(
      // @ts-expect-error: runner needs options
      runner({ log: console.log })
    ).rejects.toThrow(
      new Error('You must provide either a databaseUrl or a dbClient')
    );
  });

  it('should execute a basic up migration', async () => {
    const executedMigrations: Array<{
      id: number;
      name: string;
      run_on: Date;
    }> = [];
    let id = 1;

    const dbClient = {
      query: vi.fn((query) => {
        switch (query) {
          case 'SELECT pg_try_advisory_lock(7241865325823964) AS "lockObtained"': {
            return Promise.resolve({
              rows: [{ lockObtained: true }], // lock obtained
            });
          }

          case "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pgmigrations'": {
            return Promise.resolve({
              rows: [], // no migration table
            });
          }

          case 'CREATE TABLE "public"."pgmigrations" ( id SERIAL PRIMARY KEY, name varchar(255) NOT NULL, run_on timestamp NOT NULL)': {
            return Promise.resolve({}); // migration table created
          }

          case 'SELECT name FROM "public"."pgmigrations" ORDER BY run_on, id': {
            return Promise.resolve({
              rows: executedMigrations,
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
              executedMigrations.push({
                id: id++,
                name,
                run_on: new Date(),
              });

              return Promise.resolve({}); // migration inserted
            }

            break;
          }
        }

        // bypass migration queries
        return Promise.resolve({ rows: [{}] });
      }),
    } as unknown as ClientBase;

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
  });

  it('should execute a basic down migration', async () => {
    const executedMigrations: Array<{
      id: number;
      name: string;
      run_on: Date;
    }> = [
      { id: 1, name: '004_table', run_on: new Date() },
      { id: 2, name: '006_table_rename', run_on: new Date() },
    ];

    const dbClient = {
      query: vi.fn((query) => {
        switch (query) {
          case 'SELECT pg_try_advisory_lock(7241865325823964) AS "lockObtained"': {
            return Promise.resolve({
              rows: [{ lockObtained: true }], // lock obtained
            });
          }

          case "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pgmigrations'": {
            return Promise.resolve({
              rows: [{}], // migration table exists
            });
          }

          case "SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'pgmigrations' AND constraint_type = 'PRIMARY KEY'": {
            return Promise.resolve({}); // no primary key constraint found
          }

          case 'ALTER TABLE "public"."pgmigrations" ADD PRIMARY KEY (id)': {
            return Promise.resolve({}); // primary key constraint added
          }

          case 'SELECT name FROM "public"."pgmigrations" ORDER BY run_on, id': {
            return Promise.resolve({
              rows: executedMigrations,
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
                'DELETE FROM "public"."pgmigrations" WHERE name='
              )
            ) {
              // delete migration
              executedMigrations.pop();

              return Promise.resolve({}); // migration deleted
            }

            break;
          }
        }

        // bypass migration queries
        return Promise.resolve({ rows: [{}] });
      }),
    } as unknown as ClientBase;

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
  });
});
