import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  onTestFinished,
} from 'vitest';
import { db } from '../../../src/db';
import { introspect } from '../../../src/introspect/io/introspect';
import type {
  IntrospectOptions,
  SchemaModel,
} from '../../../src/introspect/types';
import { generateStressSchema } from '../../fixtures/generate';
import {
  createDatabase,
  databaseUrl,
  dumpSchema,
  INTEGRATION_TIMEOUT,
  loadFixture,
  loadSql,
  PG_VERSIONS,
  SCHEMA_FIXTURES,
  setupPostgresDatabase,
} from '../utils';
import { catalogQuery } from './catalog';

/**
 * Where the specs keep node-pg-migrate's migrations table: the defaults.
 */
const OPTIONS: IntrospectOptions = {
  migrationsSchema: 'public',
  migrationsTable: 'pgmigrations',
};

/**
 * The migrations table as the runner creates it (`ensureMigrationsTable()` in
 * `src/runner.ts`), with its `pgmigrations_id_seq` sequence and primary key.
 */
const CREATE_MIGRATIONS_TABLE =
  'CREATE TABLE "public"."pgmigrations" (id SERIAL PRIMARY KEY, name varchar(255) NOT NULL, run_on timestamp NOT NULL);';

/**
 * Loading and reading a thousand tables takes longer than the other tests.
 */
const LARGE_SCHEMA_TIMEOUT = INTEGRATION_TIMEOUT * 4;

/**
 * The arrays of `SchemaModel` that hold objects, apart from `dependencies` and
 * `unsupported`.
 */
type Family = Exclude<keyof SchemaModel, 'dependencies' | 'unsupported'>;

/**
 * The objects of each family, one string per object (see
 * {@link familiesOf}), sorted.
 */
type Families = Record<Family, string[]>;

/**
 * The objects of each family, read from the catalogs on their own, as JSON:
 * every schema but the system ones, without members of extensions, the
 * default migrations table and its sequence, temporary tables, and derived
 * objects (identity sequences, the functions and cast that `CREATE TYPE … AS
 * RANGE` makes, array and row types, partition clones of constraints, indexes
 * and triggers, internal triggers, indexes that back a constraint, constraints
 * that a table only inherits, and `_RETURN` rules). Extensions are the ones
 * `CREATE EXTENSION` made (not the built-in `plpgsql`), casts the ones `CREATE
 * CAST` made, and `public` is only there with a comment of its own, like
 * pg_dump.
 */
const CATALOG_FAMILIES = `
WITH
namespaces AS (
  SELECT oid, nspname FROM pg_catalog.pg_namespace
  WHERE nspname <> 'information_schema' AND nspname NOT LIKE 'pg\\_%'
),
dependencies AS (
  SELECT classid, objid, refclassid, deptype FROM pg_catalog.pg_depend WHERE deptype IN ('e', 'i')
),
relations AS (
  SELECT c.oid, c.relname, c.relkind, n.nspname, n.nspname || '.' || c.relname AS identity
  FROM pg_catalog.pg_class AS c JOIN namespaces AS n ON n.oid = c.relnamespace
  WHERE c.relpersistence <> 't'
    AND NOT (n.nspname = 'public' AND c.relname IN ('pgmigrations', 'pgmigrations_id_seq'))
    AND NOT EXISTS (SELECT FROM dependencies AS d WHERE d.deptype = 'e' AND d.classid = 'pg_catalog.pg_class'::pg_catalog.regclass AND d.objid = c.oid)
),
types AS (
  SELECT t.typtype, t.typrelid, n.nspname || '.' || t.typname AS identity
  FROM pg_catalog.pg_type AS t JOIN namespaces AS n ON n.oid = t.typnamespace
  WHERE NOT EXISTS (SELECT FROM dependencies AS d WHERE d.deptype = 'e' AND d.classid = 'pg_catalog.pg_type'::pg_catalog.regclass AND d.objid = t.oid)
),
routines AS (
  SELECT p.oid, p.prokind,
    n.nspname || '.' || p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')' AS identity
  FROM pg_catalog.pg_proc AS p JOIN namespaces AS n ON n.oid = p.pronamespace
  WHERE NOT EXISTS (SELECT FROM dependencies AS d WHERE d.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass AND d.objid = p.oid)
)
SELECT pg_catalog.json_build_object(
  'schemas', (
    SELECT coalesce(pg_catalog.json_agg(nspname), '[]') FROM namespaces
    WHERE nspname <> 'public'
      OR coalesce(pg_catalog.obj_description(oid, 'pg_namespace'), 'standard public schema') <> 'standard public schema'
  ),
  'extensions', (SELECT coalesce(pg_catalog.json_agg(extname), '[]') FROM pg_catalog.pg_extension WHERE oid >= 16384),
  'enums', (SELECT coalesce(pg_catalog.json_agg(identity), '[]') FROM types WHERE typtype = 'e'),
  'composites', (
    SELECT coalesce(pg_catalog.json_agg(t.identity), '[]') FROM types AS t
    WHERE t.typtype = 'c' AND EXISTS (SELECT FROM pg_catalog.pg_class AS c WHERE c.oid = t.typrelid AND c.relkind = 'c')
  ),
  'domains', (SELECT coalesce(pg_catalog.json_agg(identity), '[]') FROM types WHERE typtype = 'd'),
  'ranges', (SELECT coalesce(pg_catalog.json_agg(identity), '[]') FROM types WHERE typtype = 'r'),
  'collations', (
    SELECT coalesce(pg_catalog.json_agg(n.nspname || '.' || co.collname), '[]')
    FROM pg_catalog.pg_collation AS co JOIN namespaces AS n ON n.oid = co.collnamespace
    WHERE NOT EXISTS (SELECT FROM dependencies AS d WHERE d.deptype = 'e' AND d.classid = 'pg_catalog.pg_collation'::pg_catalog.regclass AND d.objid = co.oid)
  ),
  'sequences', (
    SELECT coalesce(pg_catalog.json_agg(r.identity), '[]') FROM relations AS r
    WHERE r.relkind = 'S'
      AND NOT EXISTS (
        SELECT FROM dependencies AS d
        WHERE d.deptype = 'i' AND d.classid = 'pg_catalog.pg_class'::pg_catalog.regclass AND d.objid = r.oid
          AND d.refclassid = 'pg_catalog.pg_class'::pg_catalog.regclass
      )
  ),
  'functions', (SELECT coalesce(pg_catalog.json_agg(identity), '[]') FROM routines WHERE prokind IN ('f', 'w', 'p')),
  'operators', (
    SELECT coalesce(pg_catalog.json_agg(
      n.nspname || '.' || o.oprname || '('
        || CASE WHEN o.oprleft = 0 THEN 'NONE' ELSE pg_catalog.format_type(o.oprleft, NULL) END
        || ', ' || pg_catalog.format_type(o.oprright, NULL) || ')'
    ), '[]')
    FROM pg_catalog.pg_operator AS o JOIN namespaces AS n ON n.oid = o.oprnamespace
    WHERE NOT EXISTS (SELECT FROM dependencies AS d WHERE d.deptype = 'e' AND d.classid = 'pg_catalog.pg_operator'::pg_catalog.regclass AND d.objid = o.oid)
  ),
  'casts', (
    SELECT coalesce(pg_catalog.json_agg(pg_catalog.format_type(ca.castsource, NULL) || ' AS ' || pg_catalog.format_type(ca.casttarget, NULL)), '[]')
    FROM pg_catalog.pg_cast AS ca
    WHERE ca.oid >= 16384
      AND NOT EXISTS (SELECT FROM dependencies AS d WHERE d.classid = 'pg_catalog.pg_cast'::pg_catalog.regclass AND d.objid = ca.oid)
  ),
  'aggregates', (
    SELECT coalesce(pg_catalog.json_agg(r.identity), '[]')
    FROM routines AS r JOIN pg_catalog.pg_aggregate AS a ON a.aggfnoid = r.oid
    WHERE r.prokind = 'a' AND a.aggkind = 'n'
  ),
  'tables', (SELECT coalesce(pg_catalog.json_agg(identity), '[]') FROM relations WHERE relkind IN ('r', 'p')),
  'constraints', (
    SELECT coalesce(pg_catalog.json_agg(co.conname || ' on ' || r.identity), '[]')
    FROM pg_catalog.pg_constraint AS co JOIN relations AS r ON r.oid = co.conrelid
    WHERE co.contype IN ('p', 'u', 'c', 'f', 'x') AND co.conislocal AND co.conparentid = 0
  ),
  'indexes', (
    SELECT coalesce(pg_catalog.json_agg(r.nspname || '.' || ic.relname), '[]')
    FROM pg_catalog.pg_index AS i
      JOIN pg_catalog.pg_class AS ic ON ic.oid = i.indexrelid
      JOIN relations AS r ON r.oid = i.indrelid
    WHERE NOT ic.relispartition
      AND NOT EXISTS (
        SELECT FROM pg_catalog.pg_constraint AS co
        WHERE co.conindid = i.indexrelid AND co.conrelid = i.indrelid AND co.contype IN ('p', 'u', 'x')
      )
  ),
  'views', (SELECT coalesce(pg_catalog.json_agg(identity), '[]') FROM relations WHERE relkind = 'v'),
  'materializedViews', (SELECT coalesce(pg_catalog.json_agg(identity), '[]') FROM relations WHERE relkind = 'm'),
  'triggers', (
    SELECT coalesce(pg_catalog.json_agg(tg.tgname || ' on ' || r.identity), '[]')
    FROM pg_catalog.pg_trigger AS tg JOIN relations AS r ON r.oid = tg.tgrelid
    WHERE NOT tg.tgisinternal AND tg.tgparentid = 0
  ),
  'policies', (
    SELECT coalesce(pg_catalog.json_agg(po.polname || ' on ' || r.identity), '[]')
    FROM pg_catalog.pg_policy AS po JOIN relations AS r ON r.oid = po.polrelid
  ),
  'rules', (
    SELECT coalesce(pg_catalog.json_agg(ru.rulename || ' on ' || r.identity), '[]')
    FROM pg_catalog.pg_rewrite AS ru JOIN relations AS r ON r.oid = ru.ev_class
    WHERE ru.rulename <> '_RETURN'
  ),
  'statistics', (
    SELECT coalesce(pg_catalog.json_agg(n.nspname || '.' || s.stxname), '[]')
    FROM pg_catalog.pg_statistic_ext AS s
      JOIN namespaces AS n ON n.oid = s.stxnamespace
      JOIN relations AS r ON r.oid = s.stxrelid
  )
)`;

/**
 * Sorts the objects of every family.
 *
 * @param families The objects of each family.
 *
 * @returns The same objects, each family sorted by UTF-16 code units.
 */
function sortFamilies(families: Families): Families {
  const entries = Object.entries(families).map(
    ([family, objects]) => [family, objects.toSorted()] as const
  );

  return Object.fromEntries(entries) as Families;
}

/**
 * Reads the objects of each family from the catalogs (see
 * {@link CATALOG_FAMILIES}).
 *
 * @param container The PostgreSQL container.
 * @param database The database.
 *
 * @returns The objects of each family, sorted.
 */
async function catalogFamilies(
  container: StartedPostgreSqlContainer,
  database: string
): Promise<Families> {
  const families: Families = JSON.parse(
    await catalogQuery(container, database, CATALOG_FAMILIES)
  );

  return sortFamilies(families);
}

/**
 * Writes a schema-qualified name as `schema.name`.
 *
 * @param object An object of a schema.
 *
 * @returns The name.
 */
function qualified(object: {
  readonly schema: string;
  readonly name: string;
}): string {
  return `${object.schema}.${object.name}`;
}

/**
 * The objects of each family of a model, written like
 * {@link CATALOG_FAMILIES} writes them: schemas and extensions by name,
 * routines, operators and aggregates as `schema.name(identity arguments)`,
 * casts as `source AS target`, the objects of a table as `name on
 * schema.table`, everything else as `schema.name`.
 *
 * @param model The model.
 *
 * @returns The objects of each family, sorted.
 */
function familiesOf(model: SchemaModel): Families {
  const withArguments = (object: {
    readonly schema: string;
    readonly name: string;
    readonly identityArguments: string;
  }): string => `${qualified(object)}(${object.identityArguments})`;
  const onTable = (object: {
    readonly name: string;
    readonly table: { readonly schema: string; readonly name: string };
  }): string => `${object.name} on ${qualified(object.table)}`;

  return sortFamilies({
    schemas: model.schemas.map((schema) => schema.name),
    extensions: model.extensions.map((extension) => extension.name),
    enums: model.enums.map(qualified),
    composites: model.composites.map(qualified),
    domains: model.domains.map(qualified),
    ranges: model.ranges.map(qualified),
    collations: model.collations.map(qualified),
    sequences: model.sequences.map(qualified),
    functions: model.functions.map(withArguments),
    operators: model.operators.map(withArguments),
    casts: model.casts.map((cast) => `${cast.source} AS ${cast.target}`),
    aggregates: model.aggregates.map(withArguments),
    tables: model.tables.map(qualified),
    constraints: model.constraints.map(onTable),
    indexes: model.indexes.map(qualified),
    views: model.views.map(qualified),
    materializedViews: model.materializedViews.map(qualified),
    triggers: model.triggers.map(onTable),
    policies: model.policies.map(onTable),
    rules: model.rules.map(onTable),
    statistics: model.statistics.map(qualified),
  });
}

/**
 * Connects a new client, which is closed when the current test finishes.
 *
 * @param url The connection URL.
 *
 * @returns The connected client.
 */
async function connect(url: string): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  onTestFinished(async () => {
    await client.end();
  });

  return client;
}

/**
 * Wraps a client so that every query it is asked to run first waits for
 * `beforeQuery()`.
 *
 * @param client The client.
 * @param beforeQuery What to do before each query.
 *
 * @returns A client that behaves like `client` otherwise.
 */
function interceptQueries(
  client: pg.Client,
  beforeQuery: () => Promise<void>
): pg.Client {
  return new Proxy(client, {
    get(target, property, receiver): unknown {
      const value: unknown = Reflect.get(target, property, receiver);
      if (property !== 'query' || typeof value !== 'function') {
        return value;
      }

      return async (...args: unknown[]): Promise<unknown> => {
        await beforeQuery();

        return Reflect.apply(value, target, args);
      };
    },
  });
}

describe.each(PG_VERSIONS)('introspect (PG %s)', (postgresVersion) => {
  let container: StartedPostgreSqlContainer;
  let databaseCount = 0;

  beforeAll(async () => {
    container = await setupPostgresDatabase(
      `postgres:${postgresVersion}-alpine`
    );
  }, INTEGRATION_TIMEOUT);

  afterAll(async () => {
    await container?.stop();
  });

  /**
   * Creates a database with a name no other test uses.
   *
   * @param prefix The start of the name.
   *
   * @returns The name of the new database.
   */
  async function newDatabase(prefix: string): Promise<string> {
    databaseCount += 1;
    const name = `${prefix}_${databaseCount}`;
    await createDatabase(container, name);

    return name;
  }

  /**
   * Introspects a database through a client of its own.
   *
   * @param database The database.
   *
   * @returns The model.
   */
  async function introspectDatabase(database: string): Promise<SchemaModel> {
    const client = await connect(databaseUrl(container, database));

    return introspect(db(client), OPTIONS);
  }

  it.each(SCHEMA_FIXTURES)(
    'reads every object of %s that a migration has to create, and nothing else',
    async (fixture) => {
      const database = await newDatabase(
        `objects_${fixture.replaceAll('-', '_')}`
      );
      await loadFixture(container, database, fixture);
      await loadSql(container, database, CREATE_MIGRATIONS_TABLE);
      const expected = await catalogFamilies(container, database);

      const model = await introspectDatabase(database);

      expect(familiesOf(model)).toEqual(expected);
      // None of the fixtures has an object that no migration can represent:
      // the operator classes of btree_gist and pg_trgm are members of those
      // extensions.
      expect(model.unsupported).toEqual([]);
    },
    INTEGRATION_TIMEOUT
  );

  it(
    'leaves publications and subscriptions out',
    async () => {
      const database = await newDatabase('replication');
      await loadFixture(container, database, 'kitchen-sink');
      const withoutReplication = await introspectDatabase(database);

      await loadSql(
        container,
        database,
        [
          'CREATE PUBLICATION pgm_publication FOR TABLE kitchen.orders;',
          `CREATE SUBSCRIPTION pgm_subscription CONNECTION 'dbname=${database}' PUBLICATION pgm_publication WITH (connect = false);`,
          '',
        ].join('\n')
      );

      expect(await introspectDatabase(database)).toEqual(withoutReplication);
    },
    INTEGRATION_TIMEOUT
  );

  it(
    'reads the catalogs without writing anything or blocking writers',
    async () => {
      const database = await newDatabase('read_only');
      await loadFixture(container, database, 'kitchen-sink');
      const schemaBefore = await dumpSchema(container, database);
      const url = databaseUrl(container, database);
      const reader = await connect(url);
      const writer = await connect(url);
      const { rows } = await reader.query<{ pid: number }>(
        'SELECT pg_catalog.pg_backend_pid() AS pid'
      );
      const [{ pid }] = rows;
      // A write that has to wait for a lock fails after 1 s instead of
      // hanging.
      await writer.query("SET lock_timeout = '1s'");

      // Before every query of the introspection but the first, from another
      // session: write to a table, and look at the introspection's session.
      const problems: string[] = [];
      let queries = 0;
      const reading = interceptQueries(reader, async () => {
        queries += 1;
        if (queries === 1) {
          return;
        }

        try {
          await writer.query('UPDATE kitchen.orders SET status = status');
        } catch (error) {
          problems.push(
            `before query ${queries}, the write failed: ${String(error)}`
          );
        }

        const activity = await writer.query<{ xid: string | null }>(
          'SELECT backend_xid::text AS xid FROM pg_catalog.pg_stat_activity WHERE pid = $1',
          [pid]
        );
        const [{ xid }] = activity.rows;
        if (xid !== null) {
          // Only a transaction that writes gets a transaction ID.
          problems.push(`before query ${queries}, it had written (xid ${xid})`);
        }
      });

      const model = await introspect(db(reading), OPTIONS);

      expect(model.tables).not.toHaveLength(0);
      expect(queries).toBeGreaterThan(1);
      expect(problems).toEqual([]);
      const after = await writer.query<{ state: string }>(
        'SELECT state FROM pg_catalog.pg_stat_activity WHERE pid = $1',
        [pid]
      );
      // Its transaction is over, and it left nothing behind.
      expect(after.rows).toEqual([{ state: 'idle' }]);
      expect(await dumpSchema(container, database)).toBe(schemaBefore);
    },
    INTEGRATION_TIMEOUT
  );

  it(
    'issues as many queries for 1,000 tables as for 10',
    async () => {
      /**
       * Introspects a new database with the generated stress schema,
       * counting the queries.
       *
       * @param tables How many tables the schema has.
       *
       * @returns The model and how many queries it took.
       */
      async function introspectStressSchema(
        tables: number
      ): Promise<{ readonly model: SchemaModel; readonly queries: number }> {
        const database = await newDatabase(`stress_${tables}`);
        await loadSql(container, database, generateStressSchema(tables));
        const client = await connect(databaseUrl(container, database));
        let queries = 0;
        const counting = interceptQueries(client, () => {
          queries += 1;

          return Promise.resolve();
        });

        const model = await introspect(db(counting), OPTIONS);

        return { model, queries };
      }

      const small = await introspectStressSchema(10);
      const large = await introspectStressSchema(1000);

      expect(small.model.tables).toHaveLength(10);
      expect(large.model.tables).toHaveLength(1000);
      expect(large.queries).toBe(small.queries);
    },
    LARGE_SCHEMA_TIMEOUT
  );
});
