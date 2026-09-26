import { describe, expect, it } from 'vitest';
import { generateMigration } from '../../src/codegen';
import type { Fallback, GenerateOptions } from '../../src/codegen/types';
import { rowsToModel } from '../../src/introspect/core/model';
import type { CatalogRows } from '../../src/introspect/types';
import {
  columnRow,
  constraintRow,
  dependencyRow,
  domainRow,
  emptyRows,
  FACTS,
  tableRow,
  viewRow,
} from '../introspect/rows';
import { loadMigration, runUp } from './run';
import { canonicalSteps } from './sql';

// What a TypeScript migration does with the rows that the introspection
// queries read from real PostgreSQL 18 catalogs (the rows below were read
// from databases made with the SQL in each test's comment).

const OPTIONS: GenerateOptions = {
  language: 'ts',
  defaultSchema: 'public',
  migrationName: '1700000000000_baseline',
  fakeCommand: 'node-pg-migrate up 1700000000000_baseline --fake',
  source: { serverVersion: '18.6' },
};

/**
 * Generates the migration of the model of these rows, and runs its `up`.
 *
 * @returns The canonical SQL of `up` (see `sql.ts`) and the fallbacks.
 */
async function migrationOf(rows: CatalogRows): Promise<{
  readonly sql: string[];
  readonly fallbacks: ReadonlyArray<Fallback>;
}> {
  const { content, fallbacks } = generateMigration(
    rowsToModel(rows, FACTS),
    OPTIONS
  );

  return {
    sql: canonicalSteps(await runUp(await loadMigration(content, 'ts'))),
    fallbacks,
  };
}

/**
 * The position of the one statement that matches, checking that there is
 * one.
 */
function positionOf(sql: ReadonlyArray<string>, pattern: RegExp): number {
  expect(sql).toContainEqual(expect.stringMatching(pattern));

  return sql.findIndex((statement) => pattern.test(statement));
}

describe('generateMigration from catalog rows', () => {
  it("creates a partition whose columns are in another order than its partitioned table's on its own, then attaches it", async () => {
    // CREATE TABLE public.m (id integer NOT NULL, ts date NOT NULL, v text)
    //     PARTITION BY RANGE (ts);
    // CREATE TABLE public.m_2020 (v text, ts date NOT NULL, id integer NOT NULL);
    // ALTER TABLE public.m ATTACH PARTITION public.m_2020
    //     FOR VALUES FROM ('2020-01-01') TO ('2021-01-01');
    const partitioned = { oid: 16_479, name: 'm' };
    const partition = { oid: 16_484, name: 'm_2020' };
    const { sql } = await migrationOf(
      emptyRows({
        tables: [
          tableRow(partitioned.oid, 'public', partitioned.name, {
            relkind: 'p',
            partitionKey: 'RANGE (ts)',
            accessMethod: null,
          }),
          tableRow(partition.oid, 'public', partition.name, {
            relispartition: true,
            partitionBound: "FOR VALUES FROM ('2020-01-01') TO ('2021-01-01')",
            inherits: [{ schema: 'public', name: partitioned.name }],
          }),
        ],
        columns: [
          columnRow(partitioned.oid, 1, 'id', 'integer', { attnotnull: true }),
          columnRow(partitioned.oid, 2, 'ts', 'date', { attnotnull: true }),
          columnRow(partitioned.oid, 3, 'v', 'text', {
            attstorage: 'x',
            typstorage: 'x',
          }),
          columnRow(partition.oid, 1, 'v', 'text', {
            attislocal: false,
            attinhcount: 1,
            attstorage: 'x',
            typstorage: 'x',
          }),
          columnRow(partition.oid, 2, 'ts', 'date', {
            attnotnull: true,
            attislocal: false,
            attinhcount: 1,
          }),
          columnRow(partition.oid, 3, 'id', 'integer', {
            attnotnull: true,
            attislocal: false,
            attinhcount: 1,
          }),
        ],
        constraints: [
          constraintRow(
            16_482,
            'public',
            'm_id_not_null',
            partitioned.oid,
            'n',
            'NOT NULL id',
            { conkey: [1] }
          ),
          constraintRow(
            16_483,
            'public',
            'm_ts_not_null',
            partitioned.oid,
            'n',
            'NOT NULL ts',
            { conkey: [2] }
          ),
          constraintRow(
            16_486,
            'public',
            'm_2020_id_not_null',
            partition.oid,
            'n',
            'NOT NULL id',
            { conkey: [3], conislocal: false }
          ),
          constraintRow(
            16_487,
            'public',
            'm_2020_ts_not_null',
            partition.oid,
            'n',
            'NOT NULL ts',
            { conkey: [2], conislocal: false }
          ),
        ],
      })
    );

    // `CREATE TABLE … PARTITION OF` gives a partition the column order of
    // its partitioned table.
    expect(
      sql.filter((statement) =>
        /^create (unlogged )?table (public \. )?m_2020\b/.test(statement)
      )
    ).toStrictEqual([
      expect.stringMatching(
        /^create table (public \. )?m_2020 \( v text\b.*, ts date\b.*, id integer\b/
      ),
    ]);
    const created = positionOf(sql, /^create table (public \. )?m_2020 \(/);
    const attached = positionOf(
      sql,
      /^alter table (public \. )?m attach partition (public \. )?m_2020 for values from \( '2020-01-01' \) to \( '2021-01-01' \)$/
    );
    expect(attached).toBeGreaterThan(created);
  });

  it('sets the statistics target, storage, compression and options of the columns of a materialized view, as a column settings fallback', async () => {
    // CREATE TABLE public.t3 (x integer, y text, z text);
    // CREATE MATERIALIZED VIEW public.mv3 AS SELECT x, y, z FROM public.t3;
    // ALTER MATERIALIZED VIEW public.mv3 ALTER COLUMN y SET STATISTICS 200;
    // ALTER MATERIALIZED VIEW public.mv3 ALTER COLUMN y SET STORAGE EXTERNAL;
    // ALTER MATERIALIZED VIEW public.mv3 ALTER COLUMN z SET COMPRESSION pglz;
    // ALTER MATERIALIZED VIEW public.mv3 ALTER COLUMN x SET (n_distinct = 100);
    const table = 16_498;
    const view = 16_503;
    const { sql, fallbacks } = await migrationOf(
      emptyRows({
        tables: [tableRow(table, 'public', 't3')],
        views: [
          viewRow(
            view,
            'public',
            'mv3',
            ' SELECT x,\n    y,\n    z\n   FROM public.t3;',
            { relkind: 'm', accessMethod: 'heap' }
          ),
        ],
        columns: [
          columnRow(table, 1, 'x', 'integer'),
          columnRow(table, 2, 'y', 'text', {
            attstorage: 'x',
            typstorage: 'x',
          }),
          columnRow(table, 3, 'z', 'text', {
            attstorage: 'x',
            typstorage: 'x',
          }),
          columnRow(view, 1, 'x', 'integer', {
            attoptions: ['n_distinct=100'],
          }),
          columnRow(view, 2, 'y', 'text', {
            statisticsTarget: 200,
            attstorage: 'e',
            typstorage: 'x',
          }),
          columnRow(view, 3, 'z', 'text', {
            attstorage: 'x',
            typstorage: 'x',
            attcompression: 'p',
          }),
        ],
        dependencies: [dependencyRow('pg_class', view, 'pg_class', table)],
      })
    );

    const created = positionOf(
      sql,
      /^create materialized view (public \. )?mv3 as select x , y , z from public \. t3\b/
    );
    // Each setting is an action of an `ALTER MATERIALIZED VIEW` (or `ALTER
    // TABLE`) statement on mv3, alone or among other actions.
    const alter = String.raw`^alter (materialized view|table) (public \. )?mv3 (.* , )?alter (column )?`;
    for (const setting of [
      String.raw`y set statistics 200`,
      String.raw`y set storage external`,
      String.raw`z set compression pglz`,
      // pg_dump writes attribute options unquoted, `SET (n_distinct=100)`;
      // a quoted value is the same option.
      String.raw`x set \( n_distinct = '?100'? \)`,
    ]) {
      expect(
        positionOf(sql, new RegExp(`${alter}${setting}( ,|$)`))
      ).toBeGreaterThan(created);
    }

    expect(fallbacks).toContainEqual(
      expect.objectContaining({
        identity: 'public.mv3',
        reason: 'column settings',
      })
    );
  });

  it('sets the column settings of a materialized view that is a fallback for its storage parameters too', async () => {
    // CREATE TABLE public.t4 (x integer);
    // CREATE MATERIALIZED VIEW public.mv4 WITH (fillfactor = 70)
    //     AS SELECT x FROM public.t4;
    // ALTER MATERIALIZED VIEW public.mv4 ALTER COLUMN x SET STATISTICS 300;
    const table = 16_384;
    const view = 16_387;
    const { sql, fallbacks } = await migrationOf(
      emptyRows({
        tables: [tableRow(table, 'public', 't4')],
        views: [
          viewRow(view, 'public', 'mv4', ' SELECT x\n   FROM public.t4;', {
            relkind: 'm',
            accessMethod: 'heap',
            reloptions: ['fillfactor=70'],
          }),
        ],
        columns: [
          columnRow(table, 1, 'x', 'integer'),
          columnRow(view, 1, 'x', 'integer', { statisticsTarget: 300 }),
        ],
        dependencies: [dependencyRow('pg_class', view, 'pg_class', table)],
      })
    );

    const created = positionOf(
      sql,
      /^create materialized view (public \. )?mv4 with \( fillfactor = 70 \) as select x from public \. t4\b/
    );
    expect(
      positionOf(
        sql,
        /^alter (materialized view|table) (public \. )?mv4 (.* , )?alter (column )?x set statistics 300( ,|$)/
      )
    ).toBeGreaterThan(created);
    expect(fallbacks).toContainEqual(
      expect.objectContaining({
        identity: 'public.mv4',
        reason: expect.stringContaining('column settings'),
      })
    );
  });

  it('comments on the PostgreSQL 18 NOT NULL constraints of a table, as comment on constraint fallbacks', async () => {
    // CREATE TABLE public.t (a integer NOT NULL, b integer CONSTRAINT b_nn NOT NULL);
    // COMMENT ON CONSTRAINT t_a_not_null ON public.t IS 'a is required';
    // COMMENT ON CONSTRAINT b_nn ON public.t IS 'b is required';
    const table = 16_514;
    const { sql, fallbacks } = await migrationOf(
      emptyRows({
        tables: [tableRow(table, 'public', 't')],
        columns: [
          columnRow(table, 1, 'a', 'integer', { attnotnull: true }),
          columnRow(table, 2, 'b', 'integer', { attnotnull: true }),
        ],
        constraints: [
          constraintRow(
            16_517,
            'public',
            't_a_not_null',
            table,
            'n',
            'NOT NULL a',
            {
              conkey: [1],
              comment: 'a is required',
            }
          ),
          constraintRow(16_518, 'public', 'b_nn', table, 'n', 'NOT NULL b', {
            conkey: [2],
            comment: 'b is required',
          }),
        ],
        dependencies: [
          dependencyRow('pg_constraint', 16_517, 'pg_class', table, 'a'),
          dependencyRow('pg_constraint', 16_518, 'pg_class', table, 'a'),
        ],
      })
    );

    const created = positionOf(sql, /^create table (public \. )?t \(/);
    for (const comment of [
      /^comment on constraint t_a_not_null on (public \. )?t is 'a is required'$/,
      /^comment on constraint b_nn on (public \. )?t is 'b is required'$/,
    ]) {
      expect(positionOf(sql, comment)).toBeGreaterThan(created);
    }

    expect(fallbacks).toContainEqual(
      expect.objectContaining({
        reason: expect.stringContaining('comment on constraint'),
      })
    );
  });

  it('comments on the PostgreSQL 18 NOT NULL constraint of a table that needs no fallback itself', async () => {
    // CREATE TABLE public.u (a integer NOT NULL);
    // COMMENT ON CONSTRAINT u_a_not_null ON public.u IS 'a is required';
    const table = 16_394;
    const { sql, fallbacks } = await migrationOf(
      emptyRows({
        tables: [tableRow(table, 'public', 'u')],
        columns: [columnRow(table, 1, 'a', 'integer', { attnotnull: true })],
        constraints: [
          constraintRow(
            16_397,
            'public',
            'u_a_not_null',
            table,
            'n',
            'NOT NULL a',
            {
              conkey: [1],
              comment: 'a is required',
            }
          ),
        ],
        dependencies: [
          dependencyRow('pg_constraint', 16_397, 'pg_class', table, 'a'),
        ],
      })
    );

    const created = positionOf(sql, /^create table (public \. )?u \(/);
    expect(
      positionOf(
        sql,
        /^comment on constraint u_a_not_null on (public \. )?u is 'a is required'$/
      )
    ).toBeGreaterThan(created);
    expect(fallbacks).toContainEqual(
      expect.objectContaining({
        reason: expect.stringContaining('comment on constraint'),
      })
    );
  });

  it('comments on the NOT NULL constraint of a domain, as a comment on constraint fallback', async () => {
    // CREATE DOMAIN public.dn AS integer NOT NULL;
    // COMMENT ON CONSTRAINT dn_not_null ON DOMAIN public.dn IS 'no nulls';
    const domain = 16_520;
    const { sql, fallbacks } = await migrationOf(
      emptyRows({
        domains: [domainRow(domain, 'public', 'dn', { notNull: true })],
        constraints: [
          constraintRow(16_521, 'public', 'dn_not_null', 0, 'n', 'NOT NULL', {
            typid: domain,
            comment: 'no nulls',
          }),
        ],
      })
    );

    const created = positionOf(sql, /^create domain (public \. )?dn\b/);
    expect(
      positionOf(
        sql,
        /^comment on constraint dn_not_null on domain (public \. )?dn is 'no nulls'$/
      )
    ).toBeGreaterThan(created);
    expect(fallbacks).toContainEqual(
      expect.objectContaining({
        reason: expect.stringContaining('comment on constraint'),
      })
    );
  });
});
