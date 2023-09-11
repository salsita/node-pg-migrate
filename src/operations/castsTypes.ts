import { DropOptions } from './generalTypes'

type CreateCastOptions = {
  functionName?: string
  argumentTypes?: string[]
  inout?: boolean
  as?: 'assignment' | 'implicit'
}

export type DropCast = (fromType: string, toType: string, dropOptions: DropOptions) => string

export type CreateCastFn = (fromType: string, toType: string, options: CreateCastOptions) => string

export type CreateCast = CreateCastFn & { reverse: DropCast }
