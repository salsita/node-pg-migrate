import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ClientBase } from 'pg';
import { describe, expect, it } from 'vitest';
import { baseline, BaselineError } from '../../../src';
import { adversarialPath, messageOf } from '../../baseline/helpers';
import { recordingLogger, rejectionOf, workDir } from './helpers';

// `--from-file` is the route the docs recommend when there is no route to the
// database, yet a connection that is configured but unreachable must not crash
// with a raw connection error. baseline refuses with a message that says the
// history could not be checked.

/**
 * A valid baseline dump (no migrations table, no data), so the only thing that
 * can go wrong is the connection.
 */
const DUMP = adversarialPath('comment-on-extension.sql');

/**
 * A connection string that names a host, a database and a password, pointing
 * at a port nobody listens on so connecting fails right away.
 */
const UNREACHABLE = 'postgres://appuser:s3cr3t@127.0.0.1:1/appdb';

describe('baseline --from-file with an unreachable configured connection', () => {
  it('refuses with INVALID_OPTIONS, naming the host and database but not the password', async () => {
    const dir = join(await workDir(), 'migrations');

    const error = await rejectionOf(
      baseline({
        fromFile: DUMP,
        databaseUrl: UNREACHABLE,
        dir,
        logger: { info() {}, warn() {}, error() {} },
      })
    );

    expect(error).toBeInstanceOf(BaselineError);
    expect(error).toMatchObject({ code: 'INVALID_OPTIONS' });
    const message = messageOf(error);
    expect(message).toContain('127.0.0.1');
    expect(message).toContain('appdb');
    // The password is never shown.
    expect(message).not.toContain('s3cr3t');
    // It says what could not be done, and how to do without a connection.
    expect(message).toMatch(/history/i);
    expect(message).toMatch(/connection/i);
    // Nothing is written, not even the directory.
    expect(existsSync(dir)).toBe(false);
  });

  it('does not log the raw connection error before the refusal', async () => {
    const logger = recordingLogger();

    const error = await rejectionOf(
      baseline({
        fromFile: DUMP,
        databaseUrl: UNREACHABLE,
        dir: join(await workDir(), 'migrations'),
        logger,
      })
    );

    expect(error).toMatchObject({ code: 'INVALID_OPTIONS' });
    expect(logger.messages.error).toEqual([]);
  });

  it('names localhost and no database when the connection gives neither', async () => {
    const dir = join(await workDir(), 'migrations');

    const error = await rejectionOf(
      baseline({
        fromFile: DUMP,
        databaseUrl: { port: 1, user: 'appuser', password: 's3cr3t' },
        dir,
        logger: recordingLogger(),
      })
    );

    expect(error).toMatchObject({ code: 'INVALID_OPTIONS' });
    const message = messageOf(error);
    expect(message).toContain(
      '(host localhost, database the configured database)'
    );
    expect(message).not.toContain('s3cr3t');
    expect(existsSync(dir)).toBe(false);
  });

  it('refuses a client of the caller that lost its connection, without reading its settings', async () => {
    const dir = join(await workDir(), 'migrations');
    // A client baseline did not connect: it has no host or database to name.
    const client = {
      query: () =>
        Promise.reject(new Error('Connection terminated unexpectedly')),
    } as unknown as ClientBase;

    const error = await rejectionOf(
      baseline({
        fromFile: DUMP,
        dbClient: client,
        dir,
        logger: recordingLogger(),
      })
    );

    expect(error).toMatchObject({ code: 'INVALID_OPTIONS' });
    const message = messageOf(error);
    expect(message).toContain(
      '(host the configured host, database the configured database)'
    );
    expect(existsSync(dir)).toBe(false);
  });
});
