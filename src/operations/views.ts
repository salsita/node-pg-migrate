import { MigrationOptions } from '../types'
import { escapeValue } from '../utils'
import { CreateView, DropView, AlterView, AlterViewColumn, RenameView } from './viewsTypes'

export { CreateView, DropView, AlterView, AlterViewColumn, RenameView }

export function dropView(mOptions: MigrationOptions) {
  const _drop: DropView = (viewName, options = {}) => {
    const { ifExists, cascade } = options
    const ifExistsStr = ifExists ? ' IF EXISTS' : ''
    const cascadeStr = cascade ? ' CASCADE' : ''
    const viewNameStr = mOptions.literal(viewName)
    return `DROP VIEW${ifExistsStr} ${viewNameStr}${cascadeStr};`
  }
  return _drop
}

export function createView(mOptions: MigrationOptions) {
  const _create: CreateView = (viewName, options, definition) => {
    const { temporary, replace, recursive, columns = [], checkOption } = options
    // prettier-ignore
    const columnNames = (Array.isArray(columns) ? columns : [columns]).map(mOptions.literal).join(", ");
    const replaceStr = replace ? ' OR REPLACE' : ''
    const temporaryStr = temporary ? ' TEMPORARY' : ''
    const recursiveStr = recursive ? ' RECURSIVE' : ''
    const columnStr = columnNames ? `(${columnNames})` : ''
    const checkOptionStr = checkOption ? ` WITH ${checkOption} CHECK OPTION` : ''
    const viewNameStr = mOptions.literal(viewName)

    return `CREATE${replaceStr}${temporaryStr}${recursiveStr} VIEW ${viewNameStr}${columnStr} AS ${definition}${checkOptionStr};`
  }
  _create.reverse = dropView(mOptions)
  return _create
}

export function alterView(mOptions: MigrationOptions) {
  const _alter: AlterView = (viewName, options) => {
    const { checkOption } = options
    const clauses = []
    if (checkOption !== undefined) {
      if (checkOption) {
        clauses.push(`SET check_option = ${checkOption}`)
      } else {
        clauses.push(`RESET check_option`)
      }
    }
    return clauses.map(clause => `ALTER VIEW ${mOptions.literal(viewName)} ${clause};`).join('\n')
  }
  return _alter
}

export function alterViewColumn(mOptions: MigrationOptions) {
  const _alter: AlterViewColumn = (viewName, columnName, options) => {
    const { default: defaultValue } = options
    const actions = []
    if (defaultValue === null) {
      actions.push('DROP DEFAULT')
    } else if (defaultValue !== undefined) {
      actions.push(`SET DEFAULT ${escapeValue(defaultValue)}`)
    }
    const viewNameStr = mOptions.literal(viewName)
    const columnNameStr = mOptions.literal(columnName)
    return actions.map(action => `ALTER VIEW ${viewNameStr} ALTER COLUMN ${columnNameStr} ${action};`).join('\n')
  }
  return _alter
}

export function renameView(mOptions: MigrationOptions) {
  const _rename: RenameView = (viewName, newViewName) => {
    const viewNameStr = mOptions.literal(viewName)
    const newViewNameStr = mOptions.literal(newViewName)
    return `ALTER VIEW ${viewNameStr} RENAME TO ${newViewNameStr};`
  }
  _rename.reverse = (viewName, newViewName) => _rename(newViewName, viewName)
  return _rename
}
