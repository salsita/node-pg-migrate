import type { ClientBase } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { default as runner } from '../src';

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

  it('should execute a basic up migration', () => {
    const executedMigrations: Array<{
      id: number;
      name: string;
      run_on: Date;
    }> = [];
    let id = 1;

    const dbClient = {
      query: vi.fn((query) => {
        switch (query) {
          case 'select pg_try_advisory_lock(7241865325823964) as "lockObtained"': {
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

        throw new Error('Unexpected query');
      }),
    } as unknown as ClientBase;

    runner({
      dbClient,
      migrationsTable: 'pgmigrations',
      dir: 'test/migrations',
      direction: 'up',
    });
  });
});
