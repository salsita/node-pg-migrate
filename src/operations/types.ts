import _ from 'lodash'
import { MigrationOptions } from '../types'
import { applyType, escapeValue } from '../utils'
import {
  CreateType,
  DropType,
  RenameType,
  AddTypeAttribute,
  DropTypeAttribute,
  SetTypeAttribute,
  AddTypeValue,
  RenameTypeAttribute,
  RenameTypeValue,
} from './typesTypes'

export {
  CreateType,
  DropType,
  RenameType,
  AddTypeAttribute,
  DropTypeAttribute,
  SetTypeAttribute,
  AddTypeValue,
  RenameTypeAttribute,
  RenameTypeValue,
}

export function dropType(mOptions: MigrationOptions) {
  const _drop: DropType = (typeName, options = {}) => {
    const { ifExists, cascade } = options
    const ifExistsStr = ifExists ? ' IF EXISTS' : ''
    const cascadeStr = cascade ? ' CASCADE' : ''
    const typeNameStr = mOptions.literal(typeName)
    return `DROP TYPE${ifExistsStr} ${typeNameStr}${cascadeStr};`
  }
  return _drop
}

export function createType(mOptions: MigrationOptions) {
  const _create: CreateType = (typeName, options) => {
    if (_.isArray(options)) {
      const optionsStr = options.map(escapeValue).join(', ')
      const typeNameStr = mOptions.literal(typeName)
      return `CREATE TYPE ${typeNameStr} AS ENUM (${optionsStr});`
    }
    const attributes = _.map(options, (attribute, attributeName) => {
      const typeStr = applyType(attribute, mOptions.typeShorthands).type
      return `${mOptions.literal(attributeName)} ${typeStr}`
    }).join(',\n')
    return `CREATE TYPE ${mOptions.literal(typeName)} AS (\n${attributes}\n);`
  }
  _create.reverse = dropType(mOptions)
  return _create
}

export function dropTypeAttribute(mOptions: MigrationOptions) {
  const _drop: DropTypeAttribute = (typeName, attributeName, { ifExists } = {}) => {
    const ifExistsStr = ifExists ? ' IF EXISTS' : ''
    const typeNameStr = mOptions.literal(typeName)
    const attributeNameStr = mOptions.literal(attributeName)
    return `ALTER TYPE ${typeNameStr} DROP ATTRIBUTE ${attributeNameStr}${ifExistsStr};`
  }
  return _drop
}

export function addTypeAttribute(mOptions: MigrationOptions) {
  const _alterAttributeAdd: AddTypeAttribute = (typeName, attributeName, attributeType) => {
    const typeStr = applyType(attributeType, mOptions.typeShorthands).type
    const typeNameStr = mOptions.literal(typeName)
    const attributeNameStr = mOptions.literal(attributeName)

    return `ALTER TYPE ${typeNameStr} ADD ATTRIBUTE ${attributeNameStr} ${typeStr};`
  }
  _alterAttributeAdd.reverse = dropTypeAttribute(mOptions)
  return _alterAttributeAdd
}

export function setTypeAttribute(mOptions: MigrationOptions): SetTypeAttribute {
  return (typeName, attributeName, attributeType) => {
    const typeStr = applyType(attributeType, mOptions.typeShorthands).type
    const typeNameStr = mOptions.literal(typeName)
    const attributeNameStr = mOptions.literal(attributeName)

    return `ALTER TYPE ${typeNameStr} ALTER ATTRIBUTE ${attributeNameStr} SET DATA TYPE ${typeStr};`
  }
}

export function addTypeValue(mOptions: MigrationOptions) {
  const _add: AddTypeValue = (typeName, value, options = {}) => {
    const { ifNotExists, before, after } = options

    if (before && after) {
      throw new Error('"before" and "after" can\'t be specified together')
    }
    const beforeStr = before ? ` BEFORE ${escapeValue(before)}` : ''
    const afterStr = after ? ` AFTER ${escapeValue(after)}` : ''
    const ifNotExistsStr = ifNotExists ? ' IF NOT EXISTS' : ''
    const valueStr = escapeValue(value)
    const typeNameStr = mOptions.literal(typeName)

    return `ALTER TYPE ${typeNameStr} ADD VALUE${ifNotExistsStr} ${valueStr}${beforeStr}${afterStr};`
  }
  return _add
}

export function renameType(mOptions: MigrationOptions) {
  const _rename: RenameType = (typeName, newTypeName) => {
    const typeNameStr = mOptions.literal(typeName)
    const newTypeNameStr = mOptions.literal(newTypeName)
    return `ALTER TYPE ${typeNameStr} RENAME TO ${newTypeNameStr};`
  }
  _rename.reverse = (typeName, newTypeName) => _rename(newTypeName, typeName)
  return _rename
}

export function renameTypeAttribute(mOptions: MigrationOptions) {
  const _rename: RenameTypeAttribute = (typeName, attributeName, newAttributeName) => {
    const typeNameStr = mOptions.literal(typeName)
    const attributeNameStr = mOptions.literal(attributeName)
    const newAttributeNameStr = mOptions.literal(newAttributeName)
    return `ALTER TYPE ${typeNameStr} RENAME ATTRIBUTE ${attributeNameStr} TO ${newAttributeNameStr};`
  }
  _rename.reverse = (typeName, attributeName, newAttributeName) => _rename(typeName, newAttributeName, attributeName)
  return _rename
}

export function renameTypeValue(mOptions: MigrationOptions) {
  const _rename: RenameTypeValue = (typeName, value, newValue) => {
    const valueStr = escapeValue(value)
    const newValueStr = escapeValue(newValue)
    const typeNameStr = mOptions.literal(typeName)
    return `ALTER TYPE ${typeNameStr} RENAME VALUE ${valueStr} TO ${newValueStr};`
  }
  _rename.reverse = (typeName, value, newValue) => _rename(typeName, newValue, value)
  return _rename
}
