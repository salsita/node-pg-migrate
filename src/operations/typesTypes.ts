import { Name, Value, Type, DropOptions, IfExistsOption, IfNotExistsOption } from './generalTypes'

export interface AddTypeValueOptions extends IfNotExistsOption {
  before?: string
  after?: string
}

type CreateTypeFn = (typeName: Name, values: (Value[] | { [name: string]: Type }) & DropOptions) => string | string[]
export type CreateType = CreateTypeFn & { reverse: CreateTypeFn }
export type DropType = (typeName: Name, dropOptions?: DropOptions) => string | string[]
type RenameTypeFn = (typeName: Name, newTypeName: Name) => string | string[]
export type RenameType = RenameTypeFn & { reverse: RenameTypeFn }
type AddTypeAttributeFn = (
  typeName: Name,
  attributeName: string,
  attributeType: Type & IfExistsOption,
) => string | string[]
export type AddTypeAttribute = AddTypeAttributeFn & { reverse: AddTypeAttributeFn }
export type DropTypeAttribute = (typeName: Name, attributeName: string, options: IfExistsOption) => string | string[]
export type SetTypeAttribute = (typeName: Name, attributeName: string, attributeType: Type) => string | string[]
export type AddTypeValue = (typeName: Name, value: Value, options?: AddTypeValueOptions) => string | string[]
type RenameTypeAttributeFn = (typeName: Name, attributeName: string, newAttributeName: string) => string | string[]
export type RenameTypeAttribute = RenameTypeAttributeFn & { reverse: RenameTypeAttributeFn }
type RenameTypeValueFn = (typeName: Name, value: string, newValue: string) => string | string[]
export type RenameTypeValue = RenameTypeValueFn & { reverse: RenameTypeValueFn }
