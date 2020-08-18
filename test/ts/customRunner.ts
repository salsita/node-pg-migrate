import { resolve } from 'path'
import { Client } from 'pg'
import runner, { RunnerOption } from '../../dist'

type Options = { databaseUrl: string } | { dbClient: Client }

/* eslint-disable no-console */
// eslint-disable-next-line import/prefer-default-export
export const run = async (options: Options): Promise<boolean> => {
  const opts: Omit<RunnerOption, 'direction'> & Options = {
    migrationsTable: 'migrations',
    dir: resolve(__dirname, 'migrations'),
    count: Infinity,
    ...options,
  }
  try {
    const upResult = await runner({
      ...opts,
      direction: 'up',
    })
    if (upResult.length !== 1) {
      console.error('There should be exactly one migration processed')
      return false
    }
    console.log('Up success')
    console.log(upResult)
    const downResult = await runner({
      ...opts,
      direction: 'down',
    })
    if (downResult.length !== 1) {
      console.error('There should be exactly one migration processed')
      return false
    }
    console.log('Down success')
    console.log(downResult)
    return true
  } catch (err) {
    console.error(err)
    return false
  }
}
