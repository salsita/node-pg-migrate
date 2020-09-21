import { PgLiteral } from '..'
import { Name } from './generalTypes'

export type Sql = (sqlStr: string, args?: { [key: string]: Name | PgLiteral }) => string | string[]
