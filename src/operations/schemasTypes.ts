import { DropOptions, IfNotExistsOption } from './generalTypes'

export interface CreateSchemaOptions extends IfNotExistsOption {
  authorization?: string
}

type CreateSchemaFn = (schemaName: string, schemaOptions?: CreateSchemaOptions & DropOptions) => string | string[]
export type CreateSchema = CreateSchemaFn & { reverse: CreateSchemaFn }
export type DropSchema = (schemaName: string, dropOptions?: DropOptions) => string | string[]
type RenameSchemaFn = (oldSchemaName: string, newSchemaName: string) => string | string[]
export type RenameSchema = RenameSchemaFn & { reverse: RenameSchemaFn }
