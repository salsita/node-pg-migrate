import type {
  FieldDef,
  QueryArrayConfig,
  QueryArrayResult,
  QueryConfig,
  QueryResult,
} from 'pg';
import type { DBConnection } from '../../../src/db';
import type { Expr, RelationRef, SelectStatement, Token } from './fakeSql';
import {
  containsAggregate,
  formatText,
  isStatementEnd,
  keywordAt,
  NULL_LITERAL,
  nullOr,
  Parser,
  parseRelationText,
  quoteIdent,
  stringOf,
  tokenize,
  transactionControl,
} from './fakeSql';

/**
 * A table of the fake server.
 */
export interface FakeTable {
  /**
   * The schema, as PostgreSQL stores it (no quotes).
   */
  readonly schema: string;

  /**
   * The name, as PostgreSQL stores it (no quotes).
   */
  readonly name: string;

  /**
   * How many rows it has.
   */
  readonly rows: number;

  /**
   * What `pg_get_serial_sequence(<table>, 'id')` returns: the quoted,
   * schema-qualified sequence name, e.g. `public.pgmigrations_id_seq`.
   */
  readonly serialSequence?: string;
}

/**
 * What the fake server answers.
 */
export interface FakeServerOptions {
  /**
   * What `SELECT version()` returns.
   */
  readonly version: string;

  /**
   * The settings `SHOW`, `current_setting()` and `pg_settings` return, e.g.
   * `server_version_num: '180006'`.
   */
  readonly settings: Readonly<Record<string, string>>;

  /**
   * The tables. Only these exist.
   */
  readonly tables?: ReadonlyArray<FakeTable>;

  /**
   * Makes the first statement after `BEGIN` fail with `simulated failure`.
   */
  readonly failAfterBegin?: boolean;
}

type Row = Readonly<Record<string, unknown>>;

interface Rows {
  readonly columns: ReadonlyArray<string>;
  readonly rows: ReadonlyArray<Row>;
}

interface EvaluationContext {
  readonly params: ReadonlyArray<unknown>;
  readonly row: Row;
  readonly group: ReadonlyArray<Row>;
}

/**
 * How PostgreSQL prints a `regclass`: qualified unless it is in `public`.
 */
function regclassText(table: FakeTable): string {
  return table.schema === 'public'
    ? quoteIdent(table.name)
    : `${quoteIdent(table.schema)}.${quoteIdent(table.name)}`;
}

/**
 * The result of a statement without rows.
 */
function emptyResult(command: string): QueryResult {
  return { command, rowCount: null, oid: 0, fields: [], rows: [] };
}

/**
 * A node-postgres result for rows, as objects or (`rowMode: 'array'`) as
 * arrays.
 */
function toResult(
  { columns, rows }: Rows,
  arrayMode: boolean
): QueryArrayResult | QueryResult {
  const fields: FieldDef[] = columns.map((name) => ({
    name,
    tableID: 0,
    columnID: 0,
    dataTypeID: 25,
    dataTypeSize: -1,
    dataTypeModifier: -1,
    format: 'text',
  }));

  return arrayMode
    ? {
        command: 'SELECT',
        rowCount: rows.length,
        oid: 0,
        fields,
        rows: rows.map((row) => columns.map((name) => row[name])),
      }
    : {
        command: 'SELECT',
        rowCount: rows.length,
        oid: 0,
        fields,
        rows: [...rows],
      };
}

/**
 * Casts a value the way PostgreSQL and node-postgres do: `int` gives a
 * number, `bigint` and `numeric` a string.
 */
function castValue(
  value: unknown,
  type: string,
  regclass: (text: string) => string
): unknown {
  if (value == null) {
    return null;
  }

  const text = stringOf(value);

  if (['int', 'integer', 'int2', 'int4', 'smallint'].includes(type)) {
    const number = Number.parseInt(text, 10);
    if (Number.isNaN(number)) {
      throw new TypeError(`invalid input syntax for type integer: "${text}"`);
    }

    return number;
  }

  if (['bigint', 'int8', 'numeric', 'decimal'].includes(type)) {
    return text;
  }

  if (['real', 'float4', 'float8', 'double precision'].includes(type)) {
    return Number(text);
  }

  if (['bool', 'boolean'].includes(type)) {
    return typeof value === 'boolean'
      ? value
      : ['t', 'true', 'on', '1', 'yes'].includes(text.toLowerCase());
  }

  if (type === 'regclass') {
    return regclass(text);
  }

  if (['text', 'varchar', 'character varying', 'name', 'char'].includes(type)) {
    return text;
  }

  throw new Error(`fake server: unsupported cast to ${type}`);
}

/**
 * A fake PostgreSQL server behind a {@link DBConnection}: it records every
 * statement and answers the small part of SQL that reading server facts
 * needs, the way PostgreSQL and node-postgres would.
 *
 * It understands transaction control (`BEGIN`, `START TRANSACTION`, `SET
 * TRANSACTION`, `ROLLBACK`, `COMMIT`), `SHOW <setting>`, and `SELECT` lists
 * of literals, `$n` parameters, column references, casts (`::int` gives a
 * number, `::bigint` and `::numeric` a string, like node-postgres), `||`,
 * comparisons, `AND` / `OR` / `NOT`, `IS [NOT] NULL`, `[NOT] IN (…)`,
 * `CASE`, scalar subqueries, `EXISTS (…)` and the functions `version`,
 * `current_setting`, `to_regclass`, `pg_get_serial_sequence`, `format`,
 * `quote_ident`, `quote_literal`, `coalesce`, `nullif`, `lower`, `upper`,
 * `split_part`, `concat` and `count`, `FROM` one of its tables or
 * `pg_settings`, with an optional `WHERE`. Anything else fails with
 * `fake server: unsupported …`.
 *
 * Like PostgreSQL, it fails on missing relations, and after an error inside
 * a transaction it refuses every statement but `ROLLBACK`.
 */
export class FakeServer {
  /**
   * Every statement run, in order.
   */
  readonly statements: string[] = [];

  /**
   * The connection to hand to the code under test.
   */
  readonly db: DBConnection;

  readonly #options: FakeServerOptions;

  #inTransaction = false;

  #aborted = false;

  #failNext = false;

  constructor(options: FakeServerOptions) {
    this.#options = options;
    this.db = this.#connection();
  }

  #connection(): DBConnection {
    const query: DBConnection['query'] = async (
      queryTextOrConfig: string | QueryConfig | QueryArrayConfig,
      values?: unknown[]
    ): Promise<QueryArrayResult | QueryResult> => {
      await Promise.resolve();
      if (typeof queryTextOrConfig === 'string') {
        return this.#run(queryTextOrConfig, values ?? [], false);
      }

      return this.#run(
        queryTextOrConfig.text,
        values ?? queryTextOrConfig.values ?? [],
        'rowMode' in queryTextOrConfig && queryTextOrConfig.rowMode === 'array'
      );
    };

    const select: DBConnection['select'] = async (
      queryTextOrConfig: string | QueryConfig | QueryArrayConfig,
      values?: unknown[]
    ) => {
      const { rows }: { rows: unknown[] } = await query(
        queryTextOrConfig,
        values
      );

      return rows;
    };

    const column: DBConnection['column'] = async (
      columnName: string,
      queryTextOrConfig: string | QueryConfig | QueryArrayConfig,
      values?: unknown[]
    ) => {
      const { rows }: { rows: Row[] } = await query(queryTextOrConfig, values);

      return rows.map((row) => row[columnName]);
    };

    const listeners: unknown[] = [];

    return {
      createConnection: async () => {
        await Promise.resolve();
      },
      query,
      select,
      column,
      connected: () => true,
      addBeforeCloseListener: (listener: unknown) => listeners.push(listener),
      close: async () => {
        await Promise.resolve();
      },
    };
  }

  #run(
    text: string,
    params: ReadonlyArray<unknown>,
    arrayMode: boolean
  ): QueryArrayResult | QueryResult {
    this.statements.push(text);
    const tokens = tokenize(text);
    const control = transactionControl(tokens);

    if (control === 'begin') {
      this.#inTransaction = true;
      this.#aborted = false;
      this.#failNext = this.#options.failAfterBegin === true;

      return emptyResult('BEGIN');
    }

    if (control === 'end') {
      this.#inTransaction = false;
      this.#aborted = false;
      this.#failNext = false;

      return emptyResult(keywordAt(tokens, 0).toUpperCase());
    }

    if (this.#inTransaction && this.#aborted) {
      throw new Error(
        'current transaction is aborted, commands ignored until end of transaction block'
      );
    }

    try {
      return this.#statement(tokens, params, arrayMode, control);
    } catch (error) {
      if (this.#inTransaction) {
        this.#aborted = true;
      }

      throw error;
    }
  }

  #statement(
    tokens: ReadonlyArray<Token>,
    params: ReadonlyArray<unknown>,
    arrayMode: boolean,
    control: 'set' | undefined
  ): QueryArrayResult | QueryResult {
    if (this.#failNext) {
      this.#failNext = false;
      throw new Error('simulated failure');
    }

    if (control === 'set') {
      return emptyResult('SET');
    }

    if (keywordAt(tokens, 0) === 'show') {
      const name = tokens[1];
      if (name?.type !== 'word' || !isStatementEnd(tokens, 2)) {
        throw new Error('fake server: unsupported SHOW');
      }

      return toResult(
        {
          columns: [name.value],
          rows: [{ [name.value]: this.#setting(name.value) }],
        },
        arrayMode
      );
    }

    if (keywordAt(tokens, 0) === 'select') {
      return toResult(
        this.#select(new Parser(tokens).statement(), params),
        arrayMode
      );
    }

    throw new Error('fake server: unsupported statement');
  }

  #setting(name: string): string {
    const value = this.#options.settings[name.toLowerCase()];
    if (value === undefined) {
      throw new Error(`unrecognized configuration parameter "${name}"`);
    }

    return value;
  }

  #table(ref: RelationRef): FakeTable | undefined {
    const schema = ref.schema ?? 'public';

    return (this.#options.tables ?? []).find(
      (table) => table.schema === schema && table.name === ref.name
    );
  }

  #existingTable(ref: RelationRef): FakeTable {
    const table = this.#table(ref);
    if (table === undefined) {
      throw new Error(`relation "${ref.text}" does not exist`);
    }

    return table;
  }

  #rowsOf(from: RelationRef | undefined): Row[] {
    if (from === undefined) {
      return [{}];
    }

    if (
      from.name === 'pg_settings' &&
      (from.schema === undefined || from.schema === 'pg_catalog')
    ) {
      return Object.entries(this.#options.settings).map(([name, setting]) => ({
        name,
        setting,
        unit: null,
        vartype: /^-?\d+$/.test(setting) ? 'integer' : 'string',
      }));
    }

    const table = this.#existingTable(from);

    return Array.from({ length: table.rows }, (_, index) => ({
      id: index + 1,
      name: `${String(1_700_000_000_000 + index)}_migration`,
      run_on: new Date(1_700_000_000_000 + index * 1000),
    }));
  }

  #select(statement: SelectStatement, params: ReadonlyArray<unknown>): Rows {
    const source = this.#rowsOf(statement.from);
    const filtered = source.filter(
      (row) =>
        statement.where === undefined ||
        this.#evaluate(statement.where, { params, row, group: source }) === true
    );
    const aggregate = statement.items.some((item) =>
      containsAggregate(item.expr)
    );
    const outputRows = aggregate ? [filtered[0] ?? {}] : filtered;

    return {
      columns: statement.items.map((item) => item.alias),
      rows: outputRows.map((row) => {
        const output: Record<string, unknown> = {};
        for (const item of statement.items) {
          if (item.expr.kind === 'star') {
            Object.assign(output, row);
          } else {
            output[item.alias] = this.#evaluate(item.expr, {
              params,
              row,
              group: filtered,
            });
          }
        }

        return output;
      }),
    };
  }

  #evaluate(expr: Expr, context: EvaluationContext): unknown {
    switch (expr.kind) {
      case 'literal': {
        return expr.value;
      }

      case 'param': {
        if (expr.index < 1 || expr.index > context.params.length) {
          throw new Error(`there is no parameter $${String(expr.index)}`);
        }

        return context.params[expr.index - 1];
      }

      case 'column': {
        if (!(expr.name in context.row)) {
          throw new Error(`column "${expr.name}" does not exist`);
        }

        return context.row[expr.name];
      }

      case 'star': {
        throw new Error('fake server: unsupported * in an expression');
      }

      case 'cast': {
        return castValue(
          this.#evaluate(expr.expr, context),
          expr.type,
          (text) => regclassText(this.#existingTable(parseRelationText(text)))
        );
      }

      case 'not': {
        return nullOr(this.#evaluate(expr.expr, context), (value) => !value);
      }

      case 'isNull': {
        return (this.#evaluate(expr.expr, context) == null) !== expr.negated;
      }

      case 'in': {
        const value = this.#evaluate(expr.expr, context);

        return nullOr(
          value,
          () =>
            expr.list.some(
              (item) =>
                stringOf(this.#evaluate(item, context)) === stringOf(value)
            ) !== expr.negated
        );
      }

      case 'binary': {
        return this.#binary(expr, context);
      }

      case 'case': {
        const branch = expr.branches.find(
          ({ condition }) => this.#evaluate(condition, context) === true
        );

        return this.#evaluate(
          branch?.result ?? expr.otherwise ?? NULL_LITERAL,
          context
        );
      }

      case 'subquery': {
        const { rows, columns } = this.#select(expr.select, context.params);
        if (rows.length > 1) {
          throw new Error(
            'more than one row returned by a subquery used as an expression'
          );
        }

        return rows[0]?.[columns[0] ?? ''] ?? null;
      }

      case 'exists': {
        return this.#select(expr.select, context.params).rows.length > 0;
      }

      case 'call': {
        return this.#call(expr, context);
      }
    }

    throw new Error('fake server: unknown expression');
  }

  #binary(
    expr: Extract<Expr, { kind: 'binary' }>,
    context: EvaluationContext
  ): unknown {
    const left = this.#evaluate(expr.left, context);

    if (expr.op === 'and' || expr.op === 'or') {
      const shortCircuit = expr.op === 'or';
      if (left === shortCircuit) {
        return shortCircuit;
      }

      const right = this.#evaluate(expr.right, context);
      if (right === shortCircuit) {
        return shortCircuit;
      }

      return left == null || right == null ? null : !shortCircuit;
    }

    const right = this.#evaluate(expr.right, context);
    if (left == null || right == null) {
      return null;
    }

    if (expr.op === '||') {
      return `${stringOf(left)}${stringOf(right)}`;
    }

    if (expr.op === '=') {
      return stringOf(left) === stringOf(right);
    }

    if (expr.op === '<>' || expr.op === '!=') {
      return stringOf(left) !== stringOf(right);
    }

    throw new Error(`fake server: unsupported operator ${expr.op}`);
  }

  #call(
    expr: Extract<Expr, { kind: 'call' }>,
    context: EvaluationContext
  ): unknown {
    if (expr.name === 'count') {
      const counted = expr.star
        ? context.group
        : context.group.filter(
            (row) =>
              this.#evaluate(expr.args[0] ?? NULL_LITERAL, {
                ...context,
                row,
              }) != null
          );

      return String(counted.length);
    }

    const args = expr.args.map((arg) => this.#evaluate(arg, context));
    const [first, second, third] = args;

    switch (expr.name) {
      case 'version': {
        return this.#options.version;
      }

      case 'current_setting': {
        return second === true &&
          this.#options.settings[stringOf(first)] === undefined
          ? null
          : this.#setting(stringOf(first));
      }

      case 'to_regclass': {
        return nullOr(first, (text) => {
          const table = this.#table(parseRelationText(stringOf(text)));

          return table === undefined ? null : regclassText(table);
        });
      }

      case 'pg_get_serial_sequence': {
        return this.#serialSequence(first, second);
      }

      case 'format': {
        return formatText(stringOf(first), args.slice(1));
      }

      case 'quote_ident': {
        return nullOr(first, (value) => quoteIdent(stringOf(value)));
      }

      case 'quote_literal': {
        return nullOr(
          first,
          (value) => `'${stringOf(value).replaceAll("'", "''")}'`
        );
      }

      case 'coalesce': {
        return args.find((value) => value != null) ?? null;
      }

      case 'nullif': {
        return stringOf(first) === stringOf(second) ? null : first;
      }

      case 'lower': {
        return nullOr(first, (value) => stringOf(value).toLowerCase());
      }

      case 'upper': {
        return nullOr(first, (value) => stringOf(value).toUpperCase());
      }

      case 'split_part': {
        return nullOr(
          first,
          (value) =>
            stringOf(value).split(stringOf(second))[Number(third) - 1] ?? ''
        );
      }

      case 'concat': {
        return args
          .map((value) => (value == null ? '' : stringOf(value)))
          .join('');
      }

      default: {
        throw new Error(`fake server: unsupported function ${expr.name}()`);
      }
    }
  }

  #serialSequence(table: unknown, column: unknown): unknown {
    if (table == null || column == null) {
      return null;
    }

    const found = this.#existingTable(parseRelationText(stringOf(table)));
    if (stringOf(column) !== 'id') {
      throw new Error(
        `column "${stringOf(column)}" of relation "${found.name}" does not exist`
      );
    }

    return found.serialSequence ?? null;
  }
}
