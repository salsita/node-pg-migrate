import { Name, DropOptions } from './generalTypes'

export interface CreateIndexOptions {
  name?: string
  unique?: boolean
  where?: string
  concurrently?: boolean
  ifNotExists?: boolean
  /**
   * @deprecated should be parameter of column
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
  columns: string | (string | string[])[],
  options?: CreateIndexOptions & DropIndexOptions,
) => string | string[]
export type CreateIndex = CreateIndexFn & { reverse: CreateIndexFn }
export type DropIndex = (
  tableName: Name,
  columns: string | (string | string[])[],
  options?: DropIndexOptions,
) => string | string[]
