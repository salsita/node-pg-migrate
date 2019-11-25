import { Name } from './generalTypes'

export type Sql = (sqlStr: string, args?: { [key: string]: Name }) => string | string[]
