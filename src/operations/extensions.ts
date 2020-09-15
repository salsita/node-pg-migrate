import _ from 'lodash'
import { MigrationOptions } from '../types'
import { CreateExtension, DropExtension } from './extensionsTypes'

export { CreateExtension, DropExtension }

export function dropExtension(mOptions: MigrationOptions) {
  const _drop: DropExtension = (_extensions, options = {}) => {
    const { ifExists, cascade } = options
    const extensions = _.isArray(_extensions) ? _extensions : [_extensions]
    const ifExistsStr = ifExists ? ' IF EXISTS' : ''
    const cascadeStr = cascade ? ' CASCADE' : ''
    return _.map(extensions, (extension) => {
      const extensionStr = mOptions.literal(extension)
      return `DROP EXTENSION${ifExistsStr} ${extensionStr}${cascadeStr};`
    })
  }
  return _drop
}

export function createExtension(mOptions: MigrationOptions) {
  const _create: CreateExtension = (_extensions, options = {}) => {
    const { ifNotExists, schema } = options
    const extensions = _.isArray(_extensions) ? _extensions : [_extensions]
    const ifNotExistsStr = ifNotExists ? ' IF NOT EXISTS' : ''
    const schemaStr = schema ? ` SCHEMA ${mOptions.literal(schema)}` : ''
    return _.map(extensions, (extension) => {
      const extensionStr = mOptions.literal(extension)
      return `CREATE EXTENSION${ifNotExistsStr} ${extensionStr}${schemaStr};`
    })
  }
  _create.reverse = dropExtension(mOptions)
  return _create
}
