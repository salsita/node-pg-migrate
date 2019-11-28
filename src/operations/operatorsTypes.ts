import { Name, Type, DropOptions } from './generalTypes'
import { FunctionParam } from './functionsTypes'

export interface CreateOperatorOptions {
  procedure: Name
  left?: Name
  right?: Name
  commutator?: Name
  negator?: Name
  restrict?: Name
  join?: Name
  hashes?: boolean
  merges?: boolean
}

export interface DropOperatorOptions extends DropOptions {
  left?: Name
  right?: Name
}

export interface CreateOperatorClassOptions {
  default?: boolean
  family?: string
}

export interface OperatorListDefinition {
  type: 'function' | 'operator'
  number: number
  name: Name
  params?: FunctionParam[]
}

type CreateOperatorFn = (operatorName: Name, options: CreateOperatorOptions & DropOperatorOptions) => string | string[]
export type CreateOperator = CreateOperatorFn & { reverse: CreateOperatorFn }
export type DropOperator = (operatorName: Name, dropOptions?: DropOperatorOptions) => string | string[]
type CreateOperatorClassFn = (
  operatorClassName: Name,
  type: Type,
  indexMethod: Name,
  operatorList: OperatorListDefinition[],
  options: CreateOperatorClassOptions & DropOptions,
) => string | string[]
export type CreateOperatorClass = CreateOperatorClassFn & { reverse: CreateOperatorClassFn }
export type DropOperatorClass = (
  operatorClassName: Name,
  indexMethod: Name,
  dropOptions?: DropOptions,
) => string | string[]
type RenameOperatorClassFn = (
  oldOperatorClassName: Name,
  indexMethod: Name,
  newOperatorClassName: Name,
) => string | string[]
export type RenameOperatorClass = RenameOperatorClassFn & { reverse: RenameOperatorClassFn }
type CreateOperatorFamilyFn = (operatorFamilyName: Name, indexMethod: Name, options?: DropOptions) => string | string[]
export type CreateOperatorFamily = CreateOperatorFamilyFn & { reverse: CreateOperatorFamilyFn }
export type DropOperatorFamily = (
  operatorFamilyName: Name,
  newSchemaName: Name,
  dropOptions?: DropOptions,
) => string | string[]
type RenameOperatorFamilyFn = (
  oldOperatorFamilyName: Name,
  indexMethod: Name,
  newOperatorFamilyName: Name,
) => string | string[]
export type RenameOperatorFamily = RenameOperatorFamilyFn & { reverse: RenameOperatorFamilyFn }
type AddToOperatorFamilyFn = (
  operatorFamilyName: Name,
  indexMethod: Name,
  operatorList: OperatorListDefinition[],
) => string | string[]
export type AddToOperatorFamily = AddToOperatorFamilyFn & { reverse: AddToOperatorFamilyFn }
export type RemoveFromOperatorFamily = (
  operatorFamilyName: Name,
  indexMethod: Name,
  operatorList: OperatorListDefinition[],
) => string | string[]
