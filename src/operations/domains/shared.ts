import type { DefaultValue } from '../generalTypes';

export interface DomainOptions {
  default?: DefaultValue;

  notNull?: boolean;

  check?: string;

  constraintName?: string;
}
