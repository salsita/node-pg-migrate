import { createSchemalize } from '../src/utils'
import { MigrationOptions } from '../src/types'

export const options1: MigrationOptions = {
  typeShorthands: {},
  schemalize: createSchemalize(false, false),
  literal: createSchemalize(false, true),
  logger: console,
}

export const options2: MigrationOptions = {
  typeShorthands: {},
  schemalize: createSchemalize(true, false),
  literal: createSchemalize(true, true),
  logger: console,
}
