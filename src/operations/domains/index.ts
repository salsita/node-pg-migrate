import type { Value } from './../generalTypes';

export interface DomainOptions {
  default?: Value;

  notNull?: boolean;

  check?: string;

  constraintName?: string;
}

export * from './alterDomain';
export * from './createDomain';
export * from './dropDomain';
export * from './renameDomain';
