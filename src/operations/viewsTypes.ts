import { Name, Value, DropOptions } from './generalTypes'

export interface CreateViewOptions {
  temporary?: boolean
  replace?: boolean
  recursive?: boolean
  columns?: string | string[]
  checkOption?: 'CASCADED' | 'LOCAL'
}

export interface AlterViewOptions {
  checkOption?: null | false | 'CASCADED' | 'LOCAL'
}

export interface AlterViewColumnOptions {
  default?: Value
}

type CreateViewFn = (viewName: Name, options: CreateViewOptions & DropOptions, definition: string) => string | string[]
export type CreateView = CreateViewFn & { reverse: CreateViewFn }
export type DropView = (viewName: Name, options?: DropOptions) => string | string[]
export type AlterView = (viewName: Name, options: AlterViewOptions) => string | string[]
export type AlterViewColumn = (viewName: Name, columnName: string, options: AlterViewColumnOptions) => string | string[]
type RenameViewFn = (viewName: Name, newViewName: Name) => string | string[]
export type RenameView = RenameViewFn & { reverse: RenameViewFn }
