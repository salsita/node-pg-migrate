import { createSchemalize } from '../src/utils'

export const options1 = {
  typeShorthands: {},
  schemalize: createSchemalize(false, false),
  literal: createSchemalize(false, true),
}

export const options2 = {
  typeShorthands: {},
  schemalize: createSchemalize(true, false),
  literal: createSchemalize(true, true),
}
