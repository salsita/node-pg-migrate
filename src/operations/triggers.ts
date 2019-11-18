import { isArray } from 'lodash'
import { DropOptions, Name, Value } from '../definitions'
import { MigrationOptions } from '../migration-builder'
import { escapeValue } from '../utils'
import { createFunction, dropFunction, FunctionOptions } from './functions'

export interface TriggerOptions {
  when?: 'BEFORE' | 'AFTER' | 'INSTEAD OF'
  operation: string | string[]
  constraint?: boolean
  function?: Name
  functionParams?: Value[]
  level?: 'STATEMENT' | 'ROW'
  condition?: string
  deferrable?: boolean
  deferred?: boolean
}

export function dropTrigger(mOptions: MigrationOptions) {
  const _drop = (tableName: Name, triggerName: Name, { ifExists, cascade }: DropOptions = {}) => {
    const ifExistsStr = ifExists ? ' IF EXISTS' : ''
    const cascadeStr = cascade ? ' CASCADE' : ''
    const triggerNameStr = mOptions.literal(triggerName)
    const tableNameStr = mOptions.literal(tableName)
    return `DROP TRIGGER${ifExistsStr} ${triggerNameStr} ON ${tableNameStr}${cascadeStr};`
  }
  return _drop
}

export function createTrigger(mOptions: MigrationOptions) {
  const _create = (
    tableName: Name,
    triggerName: Name,
    triggerOptions: Partial<TriggerOptions & FunctionOptions> = {},
    definition?: Value,
  ) => {
    const { constraint, condition, operation, deferrable, deferred, functionParams = [] } = triggerOptions
    let { when, level = 'STATEMENT', function: functionName } = triggerOptions
    const operations = isArray(operation) ? operation.join(' OR ') : operation
    if (constraint) {
      when = 'AFTER'
    }
    const isInsteadOf = /instead\s+of/i.test(when)
    if (isInsteadOf) {
      level = 'ROW'
    }
    if (definition) {
      functionName = functionName || triggerName
    }

    if (!when) {
      throw new Error('"when" (BEFORE/AFTER/INSTEAD OF) have to be specified')
    } else if (isInsteadOf && condition) {
      throw new Error("INSTEAD OF trigger can't have condition specified")
    }
    if (!operations) {
      throw new Error('"operation" (INSERT/UPDATE[ OF ...]/DELETE/TRUNCATE) have to be specified')
    }

    const defferStr = constraint
      ? `${deferrable ? `DEFERRABLE INITIALLY ${deferred ? 'DEFERRED' : 'IMMEDIATE'}` : 'NOT DEFERRABLE'}\n  `
      : ''
    const conditionClause = condition ? `WHEN (${condition})\n  ` : ''
    const constraintStr = constraint ? ' CONSTRAINT' : ''
    const paramsStr = functionParams.map(escapeValue).join(', ')
    const triggerNameStr = mOptions.literal(triggerName)
    const tableNameStr = mOptions.literal(tableName)
    const functionNameStr = mOptions.literal(functionName)

    const triggerSQL = `CREATE${constraintStr} TRIGGER ${triggerNameStr}
  ${when} ${operations} ON ${tableNameStr}
  ${defferStr}FOR EACH ${level}
  ${conditionClause}EXECUTE PROCEDURE ${functionNameStr}(${paramsStr});`

    const fnSQL = definition
      ? `${createFunction(mOptions)(functionName, [], { ...triggerOptions, returns: 'trigger' }, definition)}\n`
      : ''
    return `${fnSQL}${triggerSQL}`
  }

  _create.reverse = (
    tableName: Name,
    triggerName: Name,
    triggerOptions: Partial<TriggerOptions> & DropOptions = {},
    definition?: Value,
  ) => {
    const triggerSQL = dropTrigger(mOptions)(tableName, triggerName, triggerOptions)
    const fnSQL = definition
      ? `\n${dropFunction(mOptions)(triggerOptions.function || triggerName, [], triggerOptions)}`
      : ''
    return `${triggerSQL}${fnSQL}`
  }

  return _create
}

export function renameTrigger(mOptions: MigrationOptions) {
  const _rename = (tableName: Name, oldTriggerName: Name, newTriggerName: Name) => {
    const oldTriggerNameStr = mOptions.literal(oldTriggerName)
    const tableNameStr = mOptions.literal(tableName)
    const newTriggerNameStr = mOptions.literal(newTriggerName)
    return `ALTER TRIGGER ${oldTriggerNameStr} ON ${tableNameStr} RENAME TO ${newTriggerNameStr};`
  }
  _rename.reverse = (tableName: Name, oldTriggerName: Name, newTriggerName: Name) =>
    _rename(tableName, newTriggerName, oldTriggerName)
  return _rename
}
