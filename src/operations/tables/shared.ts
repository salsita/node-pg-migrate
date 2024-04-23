import type { Literal, MigrationOptions } from '../../types';
import { applyType, escapeValue, makeComment } from '../../utils';
import type { FunctionParamType } from '../functions';
import type { IfNotExistsOption, Name, Value } from '../generalTypes';
import { parseSequenceOptions, type SequenceOptions } from '../sequences';

export type Action =
  | 'NO ACTION'
  | 'RESTRICT'
  | 'CASCADE'
  | 'SET NULL'
  | 'SET DEFAULT';

export interface ReferencesOptions {
  referencesConstraintName?: string;

  referencesConstraintComment?: string;

  references: Name;

  onDelete?: Action;

  onUpdate?: Action;

  match?: 'FULL' | 'SIMPLE';
}

export type SequenceGeneratedOptions = {
  precedence: 'ALWAYS' | 'BY DEFAULT';
} & SequenceOptions;

export interface ColumnDefinition extends Partial<ReferencesOptions> {
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

  /**
   * @deprecated use sequenceGenerated
   */
  generated?: SequenceGeneratedOptions;

  sequenceGenerated?: SequenceGeneratedOptions;

  expressionGenerated?: string;
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

export interface ForeignKeyOptions extends ReferencesOptions {
  columns: Name | Name[];
}

export interface ConstraintOptions {
  check?: string | string[];

  unique?: Name | Array<Name | Name[]>;

  primaryKey?: Name | Name[];

  foreignKeys?: ForeignKeyOptions | ForeignKeyOptions[];

  exclude?: string;

  deferrable?: boolean;

  deferred?: boolean;

  comment?: string;
}

export interface TableOptions extends IfNotExistsOption {
  temporary?: boolean;

  inherits?: Name;

  like?: Name | { table: Name; options?: LikeOptions };

  constraints?: ConstraintOptions;

  comment?: string | null;
}

export function parseReferences(
  options: ReferencesOptions,
  literal: Literal
): string {
  const { references, match, onDelete, onUpdate } = options;

  const clauses: string[] = [];

  clauses.push(
    typeof references === 'string' &&
      (references.startsWith('"') || references.endsWith(')'))
      ? `REFERENCES ${references}`
      : `REFERENCES ${literal(references)}`
  );

  if (match) {
    clauses.push(`MATCH ${match}`);
  }

  if (onDelete) {
    clauses.push(`ON DELETE ${onDelete}`);
  }

  if (onUpdate) {
    clauses.push(`ON UPDATE ${onUpdate}`);
  }

  return clauses.join(' ');
}

export function parseDeferrable(options: { deferred?: boolean }): string {
  return `DEFERRABLE INITIALLY ${options.deferred ? 'DEFERRED' : 'IMMEDIATE'}`;
}

export function parseColumns(
  tableName: Name,
  columns: ColumnDefinitions,
  mOptions: MigrationOptions
): {
  columns: string[];
  constraints: ConstraintOptions;
  comments: string[];
} {
  const extendingTypeShorthands = mOptions.typeShorthands;

  let columnsWithOptions = Object.keys(columns).reduce<{
    [x: string]: ColumnDefinition & FunctionParamType;
  }>(
    (previous, column) => ({
      ...previous,
      [column]: applyType(columns[column], extendingTypeShorthands),
    }),
    {}
  );

  const primaryColumns = Object.entries(columnsWithOptions)
    .filter(([, { primaryKey }]) => Boolean(primaryKey))
    .map(([columnName]) => columnName);
  const multiplePrimaryColumns = primaryColumns.length > 1;

  if (multiplePrimaryColumns) {
    columnsWithOptions = Object.entries(columnsWithOptions).reduce(
      (previous, [columnName, options]) => ({
        ...previous,
        [columnName]: {
          ...options,
          primaryKey: false,
        },
      }),
      {}
    );
  }

  const comments = Object.entries(columnsWithOptions)
    .map(([columnName, { comment }]) => {
      return (
        typeof comment !== 'undefined' &&
        makeComment(
          'COLUMN',
          `${mOptions.literal(tableName)}.${mOptions.literal(columnName)}`,
          comment
        )
      );
    })
    .filter((comment): comment is string => Boolean(comment));

  return {
    columns: Object.entries(columnsWithOptions).map(([columnName, options]) => {
      const {
        type,
        collation,
        default: defaultValue,
        unique,
        primaryKey,
        notNull,
        check,
        references,
        referencesConstraintName,
        referencesConstraintComment,
        deferrable,
        expressionGenerated,
      }: ColumnDefinition = options;

      const sequenceGenerated =
        options.sequenceGenerated === undefined
          ? options.generated
          : options.sequenceGenerated;
      const constraints: string[] = [];

      if (collation) {
        constraints.push(`COLLATE ${collation}`);
      }

      if (defaultValue !== undefined) {
        constraints.push(`DEFAULT ${escapeValue(defaultValue)}`);
      }

      if (unique) {
        constraints.push('UNIQUE');
      }

      if (primaryKey) {
        constraints.push('PRIMARY KEY');
      }

      if (notNull) {
        constraints.push('NOT NULL');
      }

      if (check) {
        constraints.push(`CHECK (${check})`);
      }

      if (references) {
        const name =
          referencesConstraintName ||
          (referencesConstraintComment ? `${tableName}_fk_${columnName}` : '');
        const constraintName = name
          ? `CONSTRAINT ${mOptions.literal(name)} `
          : '';
        constraints.push(
          `${constraintName}${parseReferences(options as ReferencesOptions, mOptions.literal)}`
        );

        if (referencesConstraintComment) {
          comments.push(
            makeComment(
              `CONSTRAINT ${mOptions.literal(name)} ON`,
              mOptions.literal(tableName),
              referencesConstraintComment
            )
          );
        }
      }

      if (deferrable) {
        constraints.push(parseDeferrable(options));
      }

      if (sequenceGenerated) {
        const sequenceOptions = parseSequenceOptions(
          extendingTypeShorthands,
          sequenceGenerated
        ).join(' ');
        constraints.push(
          `GENERATED ${sequenceGenerated.precedence} AS IDENTITY${sequenceOptions ? ` (${sequenceOptions})` : ''}`
        );
      }

      if (expressionGenerated) {
        constraints.push(`GENERATED ALWAYS AS (${expressionGenerated}) STORED`);
      }

      const constraintsStr = constraints.length
        ? ` ${constraints.join(' ')}`
        : '';

      const sType = typeof type === 'object' ? mOptions.literal(type) : type;

      return `${mOptions.literal(columnName)} ${sType}${constraintsStr}`;
    }),
    constraints: multiplePrimaryColumns ? { primaryKey: primaryColumns } : {},
    comments,
  };
}

export function parseConstraints(
  table: Name,
  options: ConstraintOptions,
  optionName: string | null,
  literal: Literal
): {
  constraints: string[];
  comments: string[];
} {
  const {
    check,
    unique,
    primaryKey,
    foreignKeys,
    exclude,
    deferrable,
    comment,
  }: ConstraintOptions = options;

  const tableName = typeof table === 'object' ? table.name : table;

  let constraints: string[] = [];
  const comments: string[] = [];

  if (check) {
    if (Array.isArray(check)) {
      check.forEach((ch, i) => {
        const name = literal(optionName || `${tableName}_chck_${i + 1}`);
        constraints.push(`CONSTRAINT ${name} CHECK (${ch})`);
      });
    } else {
      const name = literal(optionName || `${tableName}_chck`);
      constraints.push(`CONSTRAINT ${name} CHECK (${check})`);
    }
  }

  if (unique) {
    const uniqueArray: Array<Name | Name[]> = Array.isArray(unique)
      ? unique
      : [unique];
    const isArrayOfArrays = uniqueArray.some((uniqueSet) =>
      Array.isArray(uniqueSet)
    );

    (
      (isArrayOfArrays ? uniqueArray : [uniqueArray]) as Array<Name | Name[]>
    ).forEach((uniqueSet) => {
      const cols = Array.isArray(uniqueSet) ? uniqueSet : [uniqueSet];
      const name = literal(optionName || `${tableName}_uniq_${cols.join('_')}`);

      constraints.push(
        `CONSTRAINT ${name} UNIQUE (${cols.map(literal).join(', ')})`
      );
    });
  }

  if (primaryKey) {
    const name = literal(optionName || `${tableName}_pkey`);
    const key = (Array.isArray(primaryKey) ? primaryKey : [primaryKey])
      .map(literal)
      .join(', ');

    constraints.push(`CONSTRAINT ${name} PRIMARY KEY (${key})`);
  }

  if (foreignKeys) {
    (Array.isArray(foreignKeys) ? foreignKeys : [foreignKeys]).forEach((fk) => {
      const { columns, referencesConstraintName, referencesConstraintComment } =
        fk;

      const cols = Array.isArray(columns) ? columns : [columns];
      const name = literal(
        referencesConstraintName ||
          optionName ||
          `${tableName}_fk_${cols.join('_')}`
      );
      const key = cols.map(literal).join(', ');
      const referencesStr = parseReferences(fk, literal);

      constraints.push(
        `CONSTRAINT ${name} FOREIGN KEY (${key}) ${referencesStr}`
      );

      if (referencesConstraintComment) {
        comments.push(
          makeComment(
            `CONSTRAINT ${name} ON`,
            literal(tableName),
            referencesConstraintComment
          )
        );
      }
    });
  }

  if (exclude) {
    const name = literal(optionName || `${tableName}_excl`);
    constraints.push(`CONSTRAINT ${name} EXCLUDE ${exclude}`);
  }

  if (deferrable) {
    constraints = constraints.map(
      (constraint) => `${constraint} ${parseDeferrable(options)}`
    );
  }

  if (comment) {
    if (!optionName) {
      throw new Error('cannot comment on unspecified constraints');
    }

    comments.push(
      makeComment(
        `CONSTRAINT ${literal(optionName)} ON`,
        literal(tableName),
        comment
      )
    );
  }

  return {
    constraints,
    comments,
  };
}

export function parseLike(
  like: Name | { table: Name; options?: LikeOptions },
  literal: Literal
): string {
  const formatOptions = (
    name: 'INCLUDING' | 'EXCLUDING',
    options?: Like | Like[]
  ) =>
    (Array.isArray(options) ? options : [options])
      .filter((option): option is Like => option !== undefined)
      .map((option) => ` ${name} ${option}`)
      .join('');

  const table =
    typeof like === 'string' || !('table' in like) ? like : like.table;
  const options =
    typeof like === 'string' ||
    !('options' in like) ||
    like.options === undefined
      ? ''
      : [
          formatOptions('INCLUDING', like.options.including),
          formatOptions('EXCLUDING', like.options.excluding),
        ].join('');

  return `LIKE ${literal(table)}${options}`;
}
