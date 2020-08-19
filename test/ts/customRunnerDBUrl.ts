import { run } from './customRunner'

// eslint-disable-next-line prettier/prettier
(async () => {
  process.exitCode = 1
  const result = await run({ databaseUrl: String(process.env.DATABASE_URL) })
  process.exit(result === true ? 0 : 1)
})()
