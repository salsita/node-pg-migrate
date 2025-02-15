import { resolve } from 'node:path';
import type { Client } from 'pg';
import type { RunnerOption } from '../../dist';
import { runner } from '../../dist';

type TestOptions = {
  count?: number;
  expectedUpLength?: number;
  expectedDownLength?: number;
};

type Options =
  | ({ databaseUrl: string } & TestOptions)
  | ({ dbClient: Client } & TestOptions);

export const run = async (options: Options): Promise<boolean> => {
  const opts: Omit<RunnerOption, 'direction'> & Options = {
    migrationsTable: 'migrations',
    dir: resolve(import.meta.dirname, 'migrations'),
    expectedUpLength: 2,
    expectedDownLength: 2,
    ...options,
  };
  try {
    const upResult = await runner({
      ...opts,
      direction: 'up',
    });
    if (upResult.length !== opts.expectedUpLength) {
      console.error(
        `There should be exactly ${opts.expectedUpLength} migrations processed`
      );
      return false;
    }

    console.log('Up success');
    console.log(upResult);
    const downResult = await runner({
      ...opts,
      direction: 'down',
    });
    if (downResult.length !== opts.expectedDownLength) {
      console.error(
        `There should be exactly ${opts.expectedDownLength} migrations processed`
      );
      return false;
    }

    console.log('Down success');
    console.log(downResult);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};
