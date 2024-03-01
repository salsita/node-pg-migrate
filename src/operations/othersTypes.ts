import type { Value } from '..';
import type { Name } from './generalTypes';

export type Sql = (
  sqlStr: string,
  args?: { [key: string]: Name | Value }
) => string | string[];
