import { resolve } from 'path'
import runner, { RunnerOption } from '../../dist'

const run = async () => {
  try {
    const options: Omit<RunnerOption, 'direction'> & { databaseUrl: string } = {
      migrationsTable: 'migrations',
      dir: resolve(__dirname, 'migrations'),
      count: Infinity,
      databaseUrl: process.env.DATABASE_URL,
    }
    const upResult = await runner({
      ...options,
      direction: 'up',
    })
    console.log('Up success')
    console.log(upResult)
    const downResult = await runner({
      ...options,
      direction: 'down',
    })
    console.log('Down success')
    console.log(downResult)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

run()
