import { resolve } from 'path'
import runner, { RunnerOption } from '../../dist'

/* eslint-disable no-console */
const run = async () => {
  try {
    const options: Omit<RunnerOption, 'direction'> & { databaseUrl: string } = {
      migrationsTable: 'migrations',
      dir: resolve(__dirname, 'migrations'),
      count: Infinity,
      databaseUrl: String(process.env.DATABASE_URL),
    }
    const upResult = await runner({
      ...options,
      direction: 'up',
    })
    if (upResult.length !== 1) {
      console.error('There should be exactly one migration processed')
      process.exit(1)
    }
    console.log('Up success')
    console.log(upResult)
    const downResult = await runner({
      ...options,
      direction: 'down',
    })
    if (downResult.length !== 1) {
      console.error('There should be exactly one migration processed')
      process.exit(1)
    }
    console.log('Down success')
    console.log(downResult)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

run()
