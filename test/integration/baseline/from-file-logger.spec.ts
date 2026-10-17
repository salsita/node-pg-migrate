import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { baseline } from '../../../src';
import type { db as connect } from '../../../src/db';
import { adversarialPath } from '../../baseline/helpers';
import { recordingLogger, rejectionOf, workDir } from './helpers';

// While `--from-file` checks the migration history, baseline keeps the raw
// connection error (with its stack) out of the logger, since it refuses with
// its own message instead. Everything else the connection logs still reaches
// the caller's logger. The connection only logs errors today, so this stand-in
// logs one message at every level before it connects.

vi.mock('../../../src/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/db')>();

  return {
    ...original,
    db: ((connection, logger) => {
      logger?.debug?.('connection debug');
      logger?.info('connection info');
      logger?.warn('connection warn');
      logger?.error('connection error');

      return original.db(connection, logger);
    }) satisfies typeof connect,
  };
});

describe('the logger of a --from-file history check', () => {
  it('passes debug, info and warn messages on, and keeps errors out', async () => {
    const logger = recordingLogger();

    const error = await rejectionOf(
      baseline({
        fromFile: adversarialPath('comment-on-extension.sql'),
        databaseUrl: 'postgres://appuser:s3cr3t@127.0.0.1:1/appdb',
        dir: join(await workDir(), 'migrations'),
        logger,
      })
    );

    expect(error).toMatchObject({ code: 'INVALID_OPTIONS' });
    expect(logger.messages).toEqual({
      debug: ['connection debug'],
      info: ['connection info'],
      warn: ['connection warn'],
      error: [],
    });
  });
});
