import { Name, DropOptions, IfNotExistsOption, Nullable } from './generalTypes'

export type StorageParameters = { [key: string]: boolean | number }

export interface CreateMaterializedViewOptions extends IfNotExistsOption {
  columns?: string | string[]
  tablespace?: string
  storageParameters?: StorageParameters
  data?: boolean
}

export interface AlterMaterializedViewOptions {
  cluster?: null | false | string
  extension?: string
  storageParameters?: Nullable<StorageParameters>
}

export interface RefreshMaterializedViewOptions {
  concurrently?: boolean
  data?: boolean
}

type CreateMaterializedViewFn = (
  viewName: Name,
  options: CreateMaterializedViewOptions & DropOptions,
  definition: string,
) => string | string[]
export type CreateMaterializedView = CreateMaterializedViewFn & { reverse: CreateMaterializedViewFn }
export type DropMaterializedView = (viewName: Name, options?: DropOptions) => string | string[]
export type AlterMaterializedView = (viewName: Name, options: AlterMaterializedViewOptions) => string | string[]
type RenameMaterializedViewFn = (viewName: Name, newViewName: Name) => string | string[]
export type RenameMaterializedView = RenameMaterializedViewFn & { reverse: RenameMaterializedViewFn }
type RenameMaterializedViewColumnFn = (viewName: Name, columnName: string, newColumnName: string) => string | string[]
export type RenameMaterializedViewColumn = RenameMaterializedViewColumnFn & { reverse: RenameMaterializedViewColumnFn }
type RefreshMaterializedViewFn = (viewName: Name, options?: RefreshMaterializedViewOptions) => string | string[]
export type RefreshMaterializedView = RefreshMaterializedViewFn & { reverse: RefreshMaterializedViewFn }
