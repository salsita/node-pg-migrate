import type { Value } from '../generalTypes';

export interface DomainOptions {
  default?: Value;

  notNull?: boolean;

  check?: string;

  constraintName?: string;
}
