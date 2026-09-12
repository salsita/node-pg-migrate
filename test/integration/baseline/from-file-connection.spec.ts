import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { baseline, BaselineError } from '../../../src';
import { adversarialPath, messageOf } from '../../baseline/helpers';
import { rejectionOf, workDir } from './helpers';

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
});
