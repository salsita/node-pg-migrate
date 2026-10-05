import type { Name, Value } from '../generalTypes';

export interface TriggerOptions {
  when?: 'BEFORE' | 'AFTER' | 'INSTEAD OF';

  operation: string | string[];

  /**
   * Columns that cause the UPDATE event to fire, quoted and decamelized like
   * other identifiers. Pass nonempty column names without SQL quoting. An empty
   * array leaves the events unchanged. Requires a standalone UPDATE event and
   * cannot be combined with UPDATE OF in operation or with INSTEAD OF triggers.
   */
  updateOf?: string | string[];

  constraint?: boolean;

  function?: Name;

  functionParams?: Value[];

  level?: 'STATEMENT' | 'ROW';

  condition?: string;

  deferrable?: boolean;

  deferred?: boolean;
}
