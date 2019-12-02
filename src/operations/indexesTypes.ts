import { Name, DropOptions } from './generalTypes'

export interface CreateIndexOptions {
  name?: string
  unique?: boolean
  where?: string
  concurrently?: boolean
  opclass?: Name
  method?: 'btree' | 'hash' | 'gist' | 'spgist' | 'gin'
}

export interface DropIndexOptions extends DropOptions {
  name?: string
  concurrently?: boolean
}

type CreateIndexFn = (
  tableName: Name,
  columns: string | string[],
  options?: CreateIndexOptions & DropIndexOptions,
) => string | string[]
export type CreateIndex = CreateIndexFn & { reverse: CreateIndexFn }
export type AddIndex = (tableName: Name, columns: string | string[], options?: CreateIndexOptions) => string | string[]
export type DropIndex = (tableName: Name, columns: string | string[], options?: DropIndexOptions) => string | string[]
