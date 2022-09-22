import fs from 'fs'
import { MigrationBuilderActions } from './types'

const { readFile } = fs.promises

const createMigrationCommentRegex = (direction: 'up' | 'down') =>
  new RegExp(`^\\s*--[\\s-]*${direction}\\s+migration`, 'im') // eslint-disable-line security/detect-non-literal-regexp

const noTransactionCommentRegex = /^\s*--[\s-]*no\s*transaction/i

export const getActions = (content: string): MigrationBuilderActions => {
  const upMigrationCommentRegex = createMigrationCommentRegex('up')
  const downMigrationCommentRegex = createMigrationCommentRegex('down')

  const noTransaction = content.search(noTransactionCommentRegex) >= 0
  const upMigrationStart = content.search(upMigrationCommentRegex)
  const downMigrationStart = content.search(downMigrationCommentRegex)

  const upSql =
    upMigrationStart >= 0
      ? content.substring(upMigrationStart, downMigrationStart < upMigrationStart ? undefined : downMigrationStart)
      : content
  const downSql =
    downMigrationStart >= 0
      ? content.substring(downMigrationStart, upMigrationStart < downMigrationStart ? undefined : upMigrationStart)
      : undefined
  return {
    up: (pgm) => {
      if (noTransaction) {
        pgm.noTransaction()
      }
      pgm.sql(upSql)
    },
    down:
      downSql === undefined
        ? false
        : (pgm) => {
            if (noTransaction) {
              pgm.noTransaction()
            }
            pgm.sql(downSql)
          },
  }
}

export default async (sqlPath: string) => {
  const content = await readFile(sqlPath, 'utf-8')
  return getActions(content)
}
