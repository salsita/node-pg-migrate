import _ from 'lodash'
import { MigrationOptions } from '../types'
import { CreateExtension, DropExtension } from './extensionsTypes'

export { CreateExtension, DropExtension }

export function dropExtension(mOptions: MigrationOptions) {
  const _drop: DropExtension = (extensions, options = {}) => {
    const { ifExists, cascade } = options
    if (!_.isArray(extensions)) extensions = [extensions] // eslint-disable-line no-param-reassign
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
  const _create: CreateExtension = (extensions, options = {}) => {
    const { ifNotExists, schema } = options
    if (!_.isArray(extensions)) extensions = [extensions] // eslint-disable-line no-param-reassign
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
