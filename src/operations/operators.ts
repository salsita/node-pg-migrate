import { MigrationOptions } from '../types'
import { applyType, formatParams } from '../utils'
import {
  OperatorListDefinition,
  CreateOperator,
  DropOperator,
  CreateOperatorClass,
  DropOperatorClass,
  RenameOperatorClass,
  CreateOperatorFamily,
  DropOperatorFamily,
  AddToOperatorFamily,
  RenameOperatorFamily,
  RemoveFromOperatorFamily,
} from './operatorsTypes'

export {
  CreateOperator,
  DropOperator,
  CreateOperatorClass,
  DropOperatorClass,
  RenameOperatorClass,
  CreateOperatorFamily,
  DropOperatorFamily,
  AddToOperatorFamily,
  RenameOperatorFamily,
  RemoveFromOperatorFamily,
}

export function dropOperator(mOptions: MigrationOptions) {
  const _drop: DropOperator = (operatorName, options = {}) => {
    const { ifExists, cascade, left, right } = options

    const operatorNameStr = mOptions.schemalize(operatorName)
    const leftStr = mOptions.literal(left || 'none')
    const rightStr = mOptions.literal(right || 'none')

    const ifExistsStr = ifExists ? ' IF EXISTS' : ''
    const cascadeStr = cascade ? ' CASCADE' : ''

    return `DROP OPERATOR${ifExistsStr} ${operatorNameStr}(${leftStr}, ${rightStr})${cascadeStr};`
  }
  return _drop
}

export function createOperator(mOptions: MigrationOptions) {
  const _create: CreateOperator = (operatorName, options) => {
    const { procedure, left, right, commutator, negator, restrict, join, hashes, merges } = options || {}

    const defs = []
    defs.push(`PROCEDURE = ${mOptions.literal(procedure)}`)
    if (left) {
      defs.push(`LEFTARG = ${mOptions.literal(left)}`)
    }
    if (right) {
      defs.push(`RIGHTARG = ${mOptions.literal(right)}`)
    }
    if (commutator) {
      defs.push(`COMMUTATOR = ${mOptions.schemalize(commutator)}`)
    }
    if (negator) {
      defs.push(`NEGATOR = ${mOptions.schemalize(negator)}`)
    }
    if (restrict) {
      defs.push(`RESTRICT = ${mOptions.literal(restrict)}`)
    }
    if (join) {
      defs.push(`JOIN = ${mOptions.literal(join)}`)
    }
    if (hashes) {
      defs.push('HASHES')
    }
    if (merges) {
      defs.push('MERGES')
    }
    const operatorNameStr = mOptions.schemalize(operatorName)
    return `CREATE OPERATOR ${operatorNameStr} (${defs.join(', ')});`
  }
  _create.reverse = dropOperator(mOptions)
  return _create
}

export function dropOperatorFamily(mOptions: MigrationOptions) {
  const _drop: DropOperatorFamily = (operatorFamilyName, indexMethod, options = {}) => {
    const { ifExists, cascade } = options
    const operatorFamilyNameStr = mOptions.literal(operatorFamilyName)
    const ifExistsStr = ifExists ? ' IF EXISTS' : ''
    const cascadeStr = cascade ? ' CASCADE' : ''
    return `DROP OPERATOR FAMILY ${ifExistsStr} ${operatorFamilyNameStr} USING ${indexMethod}${cascadeStr};`
  }
  return _drop
}

export function createOperatorFamily(mOptions: MigrationOptions) {
  const _create: CreateOperatorFamily = (operatorFamilyName, indexMethod) => {
    const operatorFamilyNameStr = mOptions.literal(operatorFamilyName)
    return `CREATE OPERATOR FAMILY ${operatorFamilyNameStr} USING ${indexMethod};`
  }
  _create.reverse = dropOperatorFamily(mOptions)
  return _create
}

const operatorMap = (mOptions: MigrationOptions) => ({ type, number, name, params = [] }: OperatorListDefinition) => {
  const nameStr = mOptions.literal(name)
  if (String(type).toLowerCase() === 'function') {
    if (params.length > 2) {
      throw new Error("Operator can't have more than 2 parameters")
    }
    const paramsStr = params.length > 0 ? formatParams(params, mOptions) : ''

    return `OPERATOR ${number} ${nameStr}${paramsStr}`
  }

  if (String(type).toLowerCase() === 'operator') {
    const paramsStr = formatParams(params, mOptions)
    return `FUNCTION ${number} ${nameStr}${paramsStr}`
  }

  throw new Error('Operator "type" must be either "function" or "operator"')
}

export const removeFromOperatorFamily = (mOptions: MigrationOptions) => {
  const method: RemoveFromOperatorFamily = (operatorFamilyName, indexMethod, operatorList) => {
    const operatorFamilyNameStr = mOptions.literal(operatorFamilyName)
    const operatorListStr = operatorList.map(operatorMap(mOptions)).join(',\n  ')

    return `ALTER OPERATOR FAMILY ${operatorFamilyNameStr} USING ${indexMethod} DROP
  ${operatorListStr};`
  }
  return method
}
export const addToOperatorFamily = (mOptions: MigrationOptions) => {
  const method: AddToOperatorFamily = (operatorFamilyName, indexMethod, operatorList) => {
    const operatorFamilyNameStr = mOptions.literal(operatorFamilyName)
    const operatorListStr = operatorList.map(operatorMap(mOptions)).join(',\n  ')

    return `ALTER OPERATOR FAMILY ${operatorFamilyNameStr} USING ${indexMethod} ADD
  ${operatorListStr};`
  }
  method.reverse = removeFromOperatorFamily(mOptions)
  return method
}

export function renameOperatorFamily(mOptions: MigrationOptions) {
  const _rename: RenameOperatorFamily = (oldOperatorFamilyName, indexMethod, newOperatorFamilyName) => {
    const oldOperatorFamilyNameStr = mOptions.literal(oldOperatorFamilyName)
    const newOperatorFamilyNameStr = mOptions.literal(newOperatorFamilyName)

    return `ALTER OPERATOR FAMILY ${oldOperatorFamilyNameStr} USING ${indexMethod} RENAME TO ${newOperatorFamilyNameStr};`
  }
  _rename.reverse = (oldOperatorFamilyName, indexMethod, newOperatorFamilyName) =>
    _rename(newOperatorFamilyName, indexMethod, oldOperatorFamilyName)
  return _rename
}

export function dropOperatorClass(mOptions: MigrationOptions) {
  const _drop: DropOperatorClass = (operatorClassName, indexMethod, options = {}) => {
    const { ifExists, cascade } = options
    const operatorClassNameStr = mOptions.literal(operatorClassName)
    const ifExistsStr = ifExists ? ' IF EXISTS' : ''
    const cascadeStr = cascade ? ' CASCADE' : ''

    return `DROP OPERATOR CLASS ${ifExistsStr} ${operatorClassNameStr} USING ${indexMethod}${cascadeStr};`
  }
  return _drop
}

export function createOperatorClass(mOptions: MigrationOptions) {
  const _create: CreateOperatorClass = (operatorClassName, type, indexMethod, operatorList, options) => {
    const { default: isDefault, family } = options
    const operatorClassNameStr = mOptions.literal(operatorClassName)
    const defaultStr = isDefault ? ' DEFAULT' : ''
    const typeStr = mOptions.literal(applyType(type).type)
    const indexMethodStr = mOptions.literal(indexMethod)
    const familyStr = family ? ` FAMILY ${family}` : ''
    const operatorListStr = operatorList.map(operatorMap(mOptions)).join(',\n  ')

    return `CREATE OPERATOR CLASS ${operatorClassNameStr}${defaultStr} FOR TYPE ${typeStr} USING ${indexMethodStr} ${familyStr} AS
  ${operatorListStr};`
  }
  _create.reverse = (operatorClassName, type, indexMethod, operatorList, options) =>
    dropOperatorClass(mOptions)(operatorClassName, indexMethod, options)
  return _create
}

export function renameOperatorClass(mOptions: MigrationOptions) {
  const _rename: RenameOperatorClass = (oldOperatorClassName, indexMethod, newOperatorClassName) => {
    const oldOperatorClassNameStr = mOptions.literal(oldOperatorClassName)
    const newOperatorClassNameStr = mOptions.literal(newOperatorClassName)

    return `ALTER OPERATOR CLASS ${oldOperatorClassNameStr} USING ${indexMethod} RENAME TO ${newOperatorClassNameStr};`
  }
  _rename.reverse = (oldOperatorClassName, indexMethod, newOperatorClassName) =>
    _rename(newOperatorClassName, indexMethod, oldOperatorClassName)
  return _rename
}
