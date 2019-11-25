import { Name, Value, DropOptions } from './generalTypes'
import { FunctionOptions } from './functionsTypes'

export interface TriggerOptions {
  when?: 'BEFORE' | 'AFTER' | 'INSTEAD OF'
  operation: string | string[]
  constraint?: boolean
  function?: Name
  functionParams?: Value[]
  level?: 'STATEMENT' | 'ROW'
  condition?: string
  deferrable?: boolean
  deferred?: boolean
}

interface CreateTriggerFn {
  (tableName: Name, triggerName: string, triggerOptions: TriggerOptions & DropOptions): string | string[]
  (
    tableName: Name,
    triggerName: string,
    triggerOptions: TriggerOptions & FunctionOptions & DropOptions,
    definition: Value,
  ): string | string[]
}
export type CreateTrigger = CreateTriggerFn & { reverse: CreateTriggerFn }
export type DropTrigger = (tableName: Name, triggerName: string, dropOptions?: DropOptions) => string | string[]
type RenameTriggerFn = (tableName: Name, oldTriggerName: string, newTriggerName: string) => string | string[]
export type RenameTrigger = RenameTriggerFn & { reverse: RenameTriggerFn }
