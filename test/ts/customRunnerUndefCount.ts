import { run } from './customRunner'

async function start() {
  process.exitCode = 1
  const result = await run({
    databaseUrl: String(process.env.DATABASE_URL),
    expectedUpLength: 2,
    expectedDownLength: 1,
  })
  process.exit(result === true ? 0 : 1)
}

start()
