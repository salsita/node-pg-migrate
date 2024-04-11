import type { Name, Value } from '../generalTypes';

export interface TriggerOptions {
  when?: 'BEFORE' | 'AFTER' | 'INSTEAD OF';

  operation: string | string[];

  constraint?: boolean;

  function?: Name;

  functionParams?: Value[];

  level?: 'STATEMENT' | 'ROW';

  condition?: string;

  deferrable?: boolean;

  deferred?: boolean;
}
