import fs from 'fs'
import { MigrationBuilderActions } from './types'

const { readFile } = fs.promises

const createMigrationCommentRegex = (direction: 'up' | 'down') =>
  new RegExp(`^\\s*--[\\s-]*${direction}\\s+migration`, 'im') // eslint-disable-line security/detect-non-literal-regexp

export const getActions = (content: string): MigrationBuilderActions => {
  const upMigrationCommentRegex = createMigrationCommentRegex('up')
  const downMigrationCommentRegex = createMigrationCommentRegex('down')

  const upMigrationStart = content.search(upMigrationCommentRegex)
  const downMigrationStart = content.search(downMigrationCommentRegex)

  const upSql =
    upMigrationStart >= 0
      ? content.substr(upMigrationStart, downMigrationStart < upMigrationStart ? undefined : downMigrationStart)
      : content
  const downSql =
    downMigrationStart >= 0
      ? content.substr(downMigrationStart, upMigrationStart < downMigrationStart ? undefined : upMigrationStart)
      : undefined

  return {
    up: (pgm) => pgm.sql(upSql),
    down: downSql === undefined ? false : (pgm) => pgm.sql(downSql),
  }
}

export default async (sqlPath: string) => {
  const content = await readFile(sqlPath, 'utf-8')
  return getActions(content)
}
