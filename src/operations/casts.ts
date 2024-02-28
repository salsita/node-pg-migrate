import { MigrationOptions } from '../types'
import { CreateCast, DropCast } from './castsTypes'

export { CreateCast, DropCast }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function dropCast(_mOptions: MigrationOptions) {
  const _drop: DropCast = (_fromType, _toType, options = {}) => {
    const ifExists = options.ifExists ? ' IF EXISTS' : ''
    return `DROP CAST${ifExists} (${_fromType} AS ${_toType});`
  }
  return _drop
}

export function createCast(mOptions: MigrationOptions) {
  const _create: CreateCast = (_fromType, _toType, options = {}) => {
    let conversion = ''
    if (options.functionName) {
      const args = options.argumentTypes || [_fromType]
      conversion = ` WITH FUNCTION ${options.functionName}(${args.join(', ')})`
    } else if (options.inout) {
      conversion = ' WITH INOUT'
    } else {
      conversion = ' WITHOUT FUNCTION'
    }

    const implicit = options.as ? ` AS ${options.as}` : ''

    return `CREATE CAST (${_fromType} AS ${_toType})${conversion}${implicit};`
  }
  _create.reverse = dropCast(mOptions)
  return _create
}
