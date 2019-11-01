import { PgLiteral } from './utils';
import { SequenceOptions } from './operations/sequences';

export type LiteralUnion<T extends U, U = string> =
  | T
  | (U & { zz_IGNORE_ME?: never });

interface ValueArray extends Array<Value> {}

export type Value = null | boolean | string | number | PgLiteral | ValueArray;

export type Type = string | { type: string };

export type Name = string | { schema?: string; name: string };

export type Action =
  | 'NO ACTION'
  | 'RESTRICT'
  | 'CASCADE'
  | 'SET NULL'
  | 'SET DEFAULT';

export interface ReferencesOptions {
  referencesConstraintName?: string;
  referencesConstraintComment?: string;
  references?: Name;
  onDelete?: Action;
  onUpdate?: Action;
  match?: 'FULL' | 'SIMPLE';
}

export interface ColumnDefinition extends ReferencesOptions {
  type: string;
  collation?: string;
  unique?: boolean;
  primaryKey?: boolean;
  notNull?: boolean;
  default?: Value;
  check?: string;
  deferrable?: boolean;
  deferred?: boolean;
  comment?: string | null;
  generated?: { precedence: 'ALWAYS' | 'BY DEFAULT' } & SequenceOptions;
}

export interface ColumnDefinitions {
  [name: string]: ColumnDefinition | string;
}

export type Like =
  | 'COMMENTS'
  | 'CONSTRAINTS'
  | 'DEFAULTS'
  | 'IDENTITY'
  | 'INDEXES'
  | 'STATISTICS'
  | 'STORAGE'
  | 'ALL';

export interface LikeOptions {
  including?: Like | Like[];
  excluding?: Like | Like[];
}

export interface IfNotExistsOption {
  ifNotExists?: boolean;
}

export interface IfExistsOption {
  ifExists?: boolean;
}

export interface CascadeOption {
  cascade?: boolean;
}

export type AddOptions = IfNotExistsOption;
export type DropOptions = IfExistsOption & CascadeOption;
