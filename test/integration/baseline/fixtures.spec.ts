import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  generateDumpLike,
  generateStressSchema,
} from '../../fixtures/generate';
import type { SchemaFixture } from '../utils';
import {
  createDatabase,
  dumpSchema,
  ensureRole,
  INTEGRATION_TIMEOUT,
  loadFixture,
  loadSql,
  PG_VERSIONS,
  SCHEMA_FIXTURES,
  setupPostgresDatabase,
} from '../utils';

/**
 * What a database contains, counted from the catalogs. Objects that belong to
 * extensions and the constructor functions of range types are left out.
 */
interface ObjectCounts {
  /** Schemas other than `public`. */
  readonly schemas: number;
  /** Extensions other than `plpgsql`. */
  readonly extensions: number;
  /** Tables, partitioned tables and partitions. */
  readonly tables: number;
  readonly partitions: number;
  readonly views: number;
  readonly materializedViews: number;
  readonly sequences: number;
  readonly indexes: number;
  readonly functions: number;
  readonly procedures: number;
  readonly aggregates: number;
  /** User triggers, without their clones on partitions. */
  readonly triggers: number;
  /** Foreign keys, without their clones on partitions. */
  readonly foreignKeys: number;
  readonly enums: number;
  readonly domains: number;
  readonly compositeTypes: number;
  readonly rangeTypes: number;
  readonly policies: number;
}

const COUNT_OBJECTS = `
WITH user_namespaces AS (
  SELECT oid, nspname FROM pg_catalog.pg_namespace
  WHERE nspname NOT IN ('pg_catalog', 'information_schema') AND nspname NOT LIKE 'pg\\_%'
),
dependencies AS (
  SELECT classid, objid, deptype FROM pg_catalog.pg_depend WHERE deptype IN ('e', 'i')
),
relations AS (
  SELECT c.relkind, c.relispartition FROM pg_catalog.pg_class AS c
  WHERE c.relnamespace IN (SELECT oid FROM user_namespaces)
    AND NOT EXISTS (SELECT FROM dependencies AS d WHERE d.deptype = 'e' AND d.classid = 'pg_catalog.pg_class'::regclass AND d.objid = c.oid)
),
routines AS (
  SELECT p.prokind FROM pg_catalog.pg_proc AS p
  WHERE p.pronamespace IN (SELECT oid FROM user_namespaces)
    AND NOT EXISTS (SELECT FROM dependencies AS d WHERE d.classid = 'pg_catalog.pg_proc'::regclass AND d.objid = p.oid)
),
types AS (
  SELECT t.typtype, t.typrelid FROM pg_catalog.pg_type AS t
  WHERE t.typnamespace IN (SELECT oid FROM user_namespaces)
    AND NOT EXISTS (SELECT FROM dependencies AS d WHERE d.deptype = 'e' AND d.classid = 'pg_catalog.pg_type'::regclass AND d.objid = t.oid)
)
SELECT json_build_object(
  'schemas', (SELECT count(*) FROM user_namespaces WHERE nspname <> 'public'),
  'extensions', (SELECT count(*) FROM pg_catalog.pg_extension WHERE extname <> 'plpgsql'),
  'tables', (SELECT count(*) FROM relations WHERE relkind IN ('r', 'p')),
  'partitions', (SELECT count(*) FROM relations WHERE relkind IN ('r', 'p') AND relispartition),
  'views', (SELECT count(*) FROM relations WHERE relkind = 'v'),
  'materializedViews', (SELECT count(*) FROM relations WHERE relkind = 'm'),
  'sequences', (SELECT count(*) FROM relations WHERE relkind = 'S'),
  'indexes', (SELECT count(*) FROM relations WHERE relkind IN ('i', 'I')),
  'functions', (SELECT count(*) FROM routines WHERE prokind = 'f'),
  'procedures', (SELECT count(*) FROM routines WHERE prokind = 'p'),
  'aggregates', (SELECT count(*) FROM routines WHERE prokind = 'a'),
  'triggers', (SELECT count(*) FROM pg_catalog.pg_trigger WHERE NOT tgisinternal AND tgparentid = 0),
  'foreignKeys', (SELECT count(*) FROM pg_catalog.pg_constraint WHERE contype = 'f' AND conparentid = 0),
  'enums', (SELECT count(*) FROM types WHERE typtype = 'e'),
  'domains', (SELECT count(*) FROM types WHERE typtype = 'd'),
  'compositeTypes', (SELECT count(*) FROM types AS t JOIN pg_catalog.pg_class AS c ON c.oid = t.typrelid WHERE t.typtype = 'c' AND c.relkind = 'c'),
  'rangeTypes', (SELECT count(*) FROM types WHERE typtype = 'r'),
  'policies', (SELECT count(*) FROM pg_catalog.pg_policy)
)`;

const NOTHING: ObjectCounts = {
  schemas: 0,
  extensions: 0,
  tables: 0,
  partitions: 0,
  views: 0,
  materializedViews: 0,
  sequences: 0,
  indexes: 0,
  functions: 0,
  procedures: 0,
  aggregates: 0,
  triggers: 0,
  foreignKeys: 0,
  enums: 0,
  domains: 0,
  compositeTypes: 0,
  rangeTypes: 0,
  policies: 0,
};

const FIXTURE_COUNTS: Record<SchemaFixture, ObjectCounts> = {
  pagila: {
    ...NOTHING,
    tables: 70,
    partitions: 55,
    views: 7,
    materializedViews: 1,
    sequences: 13,
    indexes: 104,
    functions: 9,
    aggregates: 1,
    triggers: 15,
    foreignKeys: 36,
    enums: 1,
    domains: 2,
  },
  chinook: {
    ...NOTHING,
    tables: 11,
    sequences: 10,
    indexes: 22,
    foreignKeys: 11,
  },
  'kitchen-sink': {
    schemas: 3,
    extensions: 2,
    tables: 23,
    partitions: 7,
    views: 6,
    materializedViews: 1,
    sequences: 14,
    indexes: 41,
    functions: 14,
    procedures: 1,
    aggregates: 1,
    triggers: 6,
    foreignKeys: 7,
    enums: 2,
    domains: 2,
    compositeTypes: 1,
    rangeTypes: 1,
    policies: 3,
  },
};

/**
 * The objects a fixture defines on a server version.
 *
 * @param fixture The fixture.
 * @param major The PostgreSQL major version.
 *
 * @returns The counts.
 */
function expectedCounts(fixture: SchemaFixture, major: number): ObjectCounts {
  const counts = FIXTURE_COUNTS[fixture];
  // kitchen-sink/90-pg18.sql adds a table with a primary key on 18+.
  const pg18Table = fixture === 'kitchen-sink' && major >= 18 ? 1 : 0;

  return {
    ...counts,
    tables: counts.tables + pg18Table,
    indexes: counts.indexes + pg18Table,
  };
}

const CHINOOK_ROWS: Readonly<Record<string, number>> = {
  album: 5,
  artist: 5,
  customer: 5,
  employee: 5,
  genre: 5,
  invoice: 2,
  invoice_line: 2,
  media_type: 5,
  playlist: 5,
  playlist_track: 5,
  track: 5,
};

/**
 * Runs a query with `psql` in the container.
 *
 * @param container The PostgreSQL container.
 * @param database The database.
 * @param sql A query that returns one value.
 *
 * @returns The value, as text.
 */
async function query(
  container: StartedPostgreSqlContainer,
  database: string,
  sql: string
): Promise<string> {
  const res = await container.exec([
    'psql',
    '-X',
    '-At',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    container.getUsername(),
    '-d',
    database,
    '-c',
    sql,
  ]);
  if (res.exitCode !== 0) {
    throw new Error(`query failed in "${database}": ${res.stderr}`);
  }

  return res.stdout.trim();
}

/**
 * Dumps a database like the capture script does, without any normalization.
 *
 * @param container The PostgreSQL container.
 * @param database The database.
 *
 * @returns The output of `pg_dump`.
 */
async function rawDump(
  container: StartedPostgreSqlContainer,
  database: string
): Promise<string> {
  const res = await container.exec([
    'pg_dump',
    '-U',
    container.getUsername(),
    '-d',
    database,
    '--schema-only',
    '--no-owner',
    '--no-privileges',
  ]);
  if (res.exitCode !== 0) {
    throw new Error(`pg_dump failed for "${database}": ${res.stderr}`);
  }

  return res.stdout;
}

/**
 * Creates a database and loads a fixture into it.
 *
 * @param container The PostgreSQL container.
 * @param database The name of the new database.
 * @param fixture The fixture.
 */
async function databaseWith(
  container: StartedPostgreSqlContainer,
  database: string,
  fixture: SchemaFixture
): Promise<void> {
  await createDatabase(container, database);
  await loadFixture(container, database, fixture);
}

describe.each(PG_VERSIONS)('schema fixtures (PG %s)', (postgresVersion) => {
  let container: StartedPostgreSqlContainer;
  let major: number;

  beforeAll(async () => {
    container = await setupPostgresDatabase(
      `postgres:${postgresVersion}-alpine`
    );
    const versionNum = await query(
      container,
      container.getDatabase(),
      'SHOW server_version_num'
    );
    major = Math.floor(Number(versionNum) / 10_000);
  }, INTEGRATION_TIMEOUT);

  afterAll(async () => {
    await container?.stop();
  });

  it.each(SCHEMA_FIXTURES)(
    'loads %s with the objects it defines',
    async (fixture) => {
      const database = `objects_${fixture.replaceAll('-', '_')}`;
      await databaseWith(container, database, fixture);

      expect(
        JSON.parse(await query(container, database, COUNT_OBJECTS))
      ).toEqual(expectedCounts(fixture, major));
    },
    INTEGRATION_TIMEOUT
  );

  it(
    'loads a few rows into every Chinook table',
    async () => {
      await databaseWith(container, 'rows_chinook', 'chinook');

      const counts = Object.keys(CHINOOK_ROWS)
        .map((table) => `'${table}', (SELECT count(*) FROM public.${table})`)
        .join(', ');
      expect(
        JSON.parse(
          await query(
            container,
            'rows_chinook',
            `SELECT json_build_object(${counts})`
          )
        )
      ).toEqual(CHINOOK_ROWS);
    },
    INTEGRATION_TIMEOUT
  );

  it.each(SCHEMA_FIXTURES)(
    'dumps %s the same from two databases and after a restore',
    async (fixture) => {
      const name = fixture.replaceAll('-', '_');
      await databaseWith(container, `twin_a_${name}`, fixture);
      await databaseWith(container, `twin_b_${name}`, fixture);
      await createDatabase(container, `restored_${name}`);
      await loadSql(
        container,
        `restored_${name}`,
        await rawDump(container, `twin_a_${name}`)
      );

      const dump = await dumpSchema(container, `twin_a_${name}`);
      expect(dump).toContain('CREATE TABLE ');
      expect(dump).not.toMatch(/^(\\restrict |\\unrestrict |-- Dumped )/m);
      expect(await dumpSchema(container, `twin_b_${name}`)).toBe(dump);
      expect(await dumpSchema(container, `restored_${name}`)).toBe(dump);
    },
    INTEGRATION_TIMEOUT
  );

  it(
    'ignores who owns public, but not an extra column',
    async () => {
      await ensureRole(container, 'postgres');
      await databaseWith(container, 'owner_default', 'chinook');
      await databaseWith(container, 'owner_postgres', 'chinook');
      await databaseWith(container, 'extra_column', 'chinook');
      await loadSql(
        container,
        'owner_postgres',
        'ALTER SCHEMA public OWNER TO postgres;'
      );
      await loadSql(
        container,
        'extra_column',
        'ALTER TABLE public.artist ADD COLUMN extra integer;'
      );

      // pg_dump 15+ writes this entry when public isn't owned by
      // pg_database_owner, even with --no-owner.
      const publicEntry = '-- *not* creating schema, since initdb creates it';
      expect(await rawDump(container, 'owner_default')).not.toContain(
        publicEntry
      );
      expect(
        (await rawDump(container, 'owner_postgres')).includes(publicEntry)
      ).toBe(major >= 15);

      const dump = await dumpSchema(container, 'owner_default');
      expect(await dumpSchema(container, 'owner_postgres')).toBe(dump);
      expect(await dumpSchema(container, 'extra_column')).not.toBe(dump);
    },
    INTEGRATION_TIMEOUT
  );

  it(
    'loads the generated stress schema with the objects it describes',
    async () => {
      await createDatabase(container, 'stress');
      await loadSql(container, 'stress', generateStressSchema(20));

      expect(
        JSON.parse(await query(container, 'stress', COUNT_OBJECTS))
      ).toEqual({
        ...NOTHING,
        tables: 20,
        views: 2,
        sequences: 20,
        indexes: 80,
        functions: 3,
        triggers: 2,
        foreignKeys: 19,
      });
    },
    INTEGRATION_TIMEOUT
  );

  // The generated text sets transaction_timeout, which PostgreSQL 17 added.
  it.runIf(Number.parseInt(postgresVersion, 10) >= 17)(
    'generates dump-like text that pg_dump prints back unchanged',
    async () => {
      const dumpLike = generateDumpLike(20);
      await createDatabase(container, 'dump_like');
      await loadSql(container, 'dump_like', dumpLike);

      const expected = dumpLike
        .split('\n')
        .filter((line) => !/^(\\restrict |\\unrestrict |-- Dumped )/.test(line))
        .join('\n');
      expect(await dumpSchema(container, 'dump_like')).toBe(expected);
    },
    INTEGRATION_TIMEOUT
  );
});
