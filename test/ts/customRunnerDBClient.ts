import { Client } from 'pg'
import { run } from './customRunner'

// eslint-disable-next-line prettier/prettier
(async () => {
  process.exitCode = 1
  const dbClient = new Client(process.env.DATABASE_URL)
  await dbClient.connect()
  const result = await run({ dbClient })
  // dbClient.end()
  process.exit(result === true ? 0 : 1)
})()
