import { run } from './customRunner'

async function start() {
  process.exitCode = 1
  const result = await run({ databaseUrl: String(process.env.DATABASE_URL) })
  process.exit(result === true ? 0 : 1)
}

start()
