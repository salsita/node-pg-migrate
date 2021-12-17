import { Client } from 'pg'
import { run } from './customRunner'

async function start() {
  process.exitCode = 1
  const dbClient = new Client(process.env.DATABASE_URL)
  await dbClient.connect()
  const result = await run({ dbClient, count: Infinity })
  // dbClient.end()
  process.exit(result === true ? 0 : 1)
}

start()
