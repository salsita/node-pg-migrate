import { Name, DropOptions } from './generalTypes'

export interface IndexColumn {
  name: string
  opclass?: Name
  sort?: 'ASC' | 'DESC'
}

export interface CreateIndexOptions {
  name?: string
  unique?: boolean
  where?: string
  concurrently?: boolean
  ifNotExists?: boolean
  /**
   * @deprecated should be parameter of IndexColumn
   */
  opclass?: Name
  method?: 'btree' | 'hash' | 'gist' | 'spgist' | 'gin'
  include?: string | string[]
}

export interface DropIndexOptions extends DropOptions {
  name?: string
  concurrently?: boolean
}

type CreateIndexFn = (
  tableName: Name,
  columns: string | (string | IndexColumn)[],
  options?: CreateIndexOptions & DropIndexOptions,
) => string | string[]
export type CreateIndex = CreateIndexFn & { reverse: CreateIndexFn }
export type DropIndex = (
  tableName: Name,
  columns: string | (string | IndexColumn)[],
  options?: DropIndexOptions,
) => string | string[]
