import { MigrationOptions } from '../types'
import { CreateSchema, DropSchema, RenameSchema } from './schemasTypes'

export { CreateSchema, DropSchema, RenameSchema }

export function dropSchema(mOptions: MigrationOptions) {
  const _drop: DropSchema = (schemaName, options = {}) => {
    const { ifExists, cascade } = options
    const ifExistsStr = ifExists ? ' IF EXISTS' : ''
    const cascadeStr = cascade ? ' CASCADE' : ''
    const schemaNameStr = mOptions.literal(schemaName)
    return `DROP SCHEMA${ifExistsStr} ${schemaNameStr}${cascadeStr};`
  }
  return _drop
}

export function createSchema(mOptions: MigrationOptions) {
  const _create: CreateSchema = (schemaName: string, options = {}) => {
    const { ifNotExists, authorization } = options
    const ifNotExistsStr = ifNotExists ? ' IF NOT EXISTS' : ''
    const schemaNameStr = mOptions.literal(schemaName)
    const authorizationStr = authorization ? ` AUTHORIZATION ${authorization}` : ''
    return `CREATE SCHEMA${ifNotExistsStr} ${schemaNameStr}${authorizationStr};`
  }
  _create.reverse = dropSchema(mOptions)
  return _create
}

export function renameSchema(mOptions: MigrationOptions) {
  const _rename: RenameSchema = (schemaName, newSchemaName) => {
    const schemaNameStr = mOptions.literal(schemaName)
    const newSchemaNameStr = mOptions.literal(newSchemaName)
    return `ALTER SCHEMA ${schemaNameStr} RENAME TO ${newSchemaNameStr};`
  }
  _rename.reverse = (schemaName, newSchemaName) => _rename(newSchemaName, schemaName)
  return _rename
}
