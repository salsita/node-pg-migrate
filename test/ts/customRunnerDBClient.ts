import pg from 'pg';
import { run } from './customRunner';

async function start(): Promise<void> {
  process.exitCode = 1;
  const dbClient = new pg.Client(process.env.DATABASE_URL);
  await dbClient.connect();
  const result = await run({ dbClient, count: Number.POSITIVE_INFINITY });
  // dbClient.end()
  process.exit(result ? 0 : 1);
}

start();
