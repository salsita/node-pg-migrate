import { run } from './customRunner';

async function start() {
  process.exitCode = 1;
  const result = await run({
    databaseUrl: String(process.env.DATABASE_URL),
    count: Infinity,
  });
  process.exit(result ? 0 : 1);
}

start();
