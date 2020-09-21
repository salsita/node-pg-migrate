import { Value } from '..'
import { Name } from './generalTypes'

export type Sql = (sqlStr: string, args?: { [key: string]: Name | Value }) => string | string[]
