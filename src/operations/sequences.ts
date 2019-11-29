import { MigrationOptions } from '../types'
import { applyType } from '../utils'
import { SequenceOptions, CreateSequence, DropSequence, AlterSequence, RenameSequence } from './sequencesTypes'
import { ColumnDefinitions } from './tablesTypes'

export { CreateSequence, DropSequence, AlterSequence, RenameSequence }

export const parseSequenceOptions = (typeShorthands: ColumnDefinitions | undefined, options: SequenceOptions) => {
  const { type, increment, minvalue, maxvalue, start, cache, cycle, owner } = options
  const clauses: string[] = []
  if (type) {
    clauses.push(`AS ${applyType(type, typeShorthands).type}`)
  }
  if (increment) {
    clauses.push(`INCREMENT BY ${increment}`)
  }
  if (minvalue) {
    clauses.push(`MINVALUE ${minvalue}`)
  } else if (minvalue === null || minvalue === false) {
    clauses.push('NO MINVALUE')
  }
  if (maxvalue) {
    clauses.push(`MAXVALUE ${maxvalue}`)
  } else if (maxvalue === null || maxvalue === false) {
    clauses.push('NO MAXVALUE')
  }
  if (start) {
    clauses.push(`START WITH ${start}`)
  }
  if (cache) {
    clauses.push(`CACHE ${cache}`)
  }
  if (cycle) {
    clauses.push('CYCLE')
  } else if (cycle === false) {
    clauses.push('NO CYCLE')
  }
  if (owner) {
    clauses.push(`OWNED BY ${owner}`)
  } else if (owner === null || owner === false) {
    clauses.push('OWNED BY NONE')
  }
  return clauses
}

export function dropSequence(mOptions: MigrationOptions) {
  const _drop: DropSequence = (sequenceName, options = {}) => {
    const { ifExists, cascade } = options
    const ifExistsStr = ifExists ? ' IF EXISTS' : ''
    const cascadeStr = cascade ? ' CASCADE' : ''
    const sequenceNameStr = mOptions.literal(sequenceName)
    return `DROP SEQUENCE${ifExistsStr} ${sequenceNameStr}${cascadeStr};`
  }
  return _drop
}

export function createSequence(mOptions: MigrationOptions) {
  const _create: CreateSequence = (sequenceName, options = {}) => {
    const { temporary, ifNotExists } = options
    const temporaryStr = temporary ? ' TEMPORARY' : ''
    const ifNotExistsStr = ifNotExists ? ' IF NOT EXISTS' : ''
    const sequenceNameStr = mOptions.literal(sequenceName)
    const clausesStr = parseSequenceOptions(mOptions.typeShorthands, options).join('\n  ')
    return `CREATE${temporaryStr} SEQUENCE${ifNotExistsStr} ${sequenceNameStr}
  ${clausesStr};`
  }
  _create.reverse = dropSequence(mOptions)
  return _create
}

export function alterSequence(mOptions: MigrationOptions): AlterSequence {
  return (sequenceName, options) => {
    const { restart } = options
    const clauses = parseSequenceOptions(mOptions.typeShorthands, options)
    if (restart) {
      if (restart === true) {
        clauses.push('RESTART')
      } else {
        clauses.push(`RESTART WITH ${restart}`)
      }
    }
    return `ALTER SEQUENCE ${mOptions.literal(sequenceName)}
  ${clauses.join('\n  ')};`
  }
}

export function renameSequence(mOptions: MigrationOptions) {
  const _rename: RenameSequence = (sequenceName, newSequenceName) => {
    const sequenceNameStr = mOptions.literal(sequenceName)
    const newSequenceNameStr = mOptions.literal(newSequenceName)
    return `ALTER SEQUENCE ${sequenceNameStr} RENAME TO ${newSequenceNameStr};`
  }
  _rename.reverse = (sequenceName, newSequenceName) => _rename(newSequenceName, sequenceName)
  return _rename
}
