import { run } from './customRunner';

async function start(): Promise<void> {
  process.exitCode = 1;
  const result = await run({
    databaseUrl: String(process.env.DATABASE_URL),
    count: Number.POSITIVE_INFINITY,
  });
  process.exit(result ? 0 : 1);
}

start();
