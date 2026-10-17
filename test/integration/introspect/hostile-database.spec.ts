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
  ObjectRef,
  SchemaModel,
} from '../../../src/introspect/types';
import {
  createDatabase,
  databaseUrl,
  INTEGRATION_TIMEOUT,
  loadFixture,
  loadSql,
  PG_VERSIONS,
  setupPostgresDatabase,
} from '../utils';
import { catalogQuery } from './catalog';

const OPTIONS: IntrospectOptions = {
  migrationsSchema: 'public',
  migrationsTable: 'pgmigrations',
};

/**
 * Casts and an operator that a database may define, and that break any
 * catalog query that relies on them: casts apply whatever the search path,
 * and a query that isn't careful about its operators may pick one of the
 * database's. The casts from text call themselves (like the dogfood
 * database's `text AS integer`, see `test/migrations/090_create_cast.js`),
 * so running them fails with "stack depth limit exceeded"; the others raise
 * an error. The names of their functions start with `hostile_`.
 */
const HOSTILE_OBJECTS = `
CREATE FUNCTION public.hostile_text_to_integer(value text) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE AS $$ BEGIN RETURN CAST(value AS integer); END $$;
CREATE CAST (text AS integer) WITH FUNCTION public.hostile_text_to_integer(text) AS IMPLICIT;

CREATE FUNCTION public.hostile_text_to_bigint(value text) RETURNS bigint
    LANGUAGE plpgsql IMMUTABLE AS $$ BEGIN RETURN CAST(value AS bigint); END $$;
CREATE CAST (text AS bigint) WITH FUNCTION public.hostile_text_to_bigint(text) AS IMPLICIT;

CREATE CAST (character varying AS integer) WITH INOUT AS IMPLICIT;

CREATE FUNCTION public.hostile_bigint_to_text(value bigint) RETURNS text
    LANGUAGE plpgsql IMMUTABLE AS $$ BEGIN RAISE EXCEPTION 'a cast of the database ran'; END $$;
CREATE CAST (bigint AS text) WITH FUNCTION public.hostile_bigint_to_text(bigint) AS IMPLICIT;

CREATE FUNCTION public.hostile_oid_to_text(value oid) RETURNS text
    LANGUAGE plpgsql IMMUTABLE AS $$ BEGIN RAISE EXCEPTION 'a cast of the database ran'; END $$;
CREATE CAST (oid AS text) WITH FUNCTION public.hostile_oid_to_text(oid) AS IMPLICIT;

CREATE FUNCTION public.hostile_text_equals(a text, b text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE AS $$ BEGIN RAISE EXCEPTION 'an operator of the database ran'; END $$;
CREATE OPERATOR public.= (LEFTARG = text, RIGHTARG = text, FUNCTION = public.hostile_text_equals);
`;

/**
 * The casts of {@link HOSTILE_OBJECTS}, as `source AS target (method)`.
 */
const HOSTILE_CASTS = [
  'bigint AS text (function)',
  'character varying AS integer (inout)',
  'oid AS text (function)',
  'text AS bigint (function)',
  'text AS integer (function)',
];

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
 * A model without the objects of {@link HOSTILE_OBJECTS} and the
 * dependencies on them.
 *
 * @param model The model of a database with those objects.
 *
 * @returns The model it had before they were created.
 */
function withoutHostileObjects(model: SchemaModel): SchemaModel {
  const removed = new Set<string>();
  const key = (ref: ObjectRef): string => `${ref.kind}:${ref.oid}`;
  const keep = <T extends ObjectRef>(
    objects: ReadonlyArray<T>,
    isHostile: (object: T) => boolean
  ): T[] =>
    objects.filter((object) => {
      if (isHostile(object)) {
        removed.add(key(object));

        return false;
      }

      return true;
    });

  const functions = keep(model.functions, ({ name }) =>
    name.startsWith('hostile_')
  );
  const operators = keep(
    model.operators,
    ({ schema, name }) => schema === 'public' && name === '='
  );
  const casts = keep(model.casts, ({ source, target, method }) =>
    HOSTILE_CASTS.includes(`${source} AS ${target} (${method})`)
  );

  return {
    ...model,
    functions,
    operators,
    casts,
    dependencies: model.dependencies.filter(
      ({ from, to }) => !removed.has(key(from)) && !removed.has(key(to))
    ),
  };
}

describe.each(PG_VERSIONS)(
  'introspect on a database with casts and operators of its own (PG %s)',
  (postgresVersion) => {
    let container: StartedPostgreSqlContainer;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${postgresVersion}-alpine`
      );
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      await container?.stop();
    });

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

    it(
      'reads every object without running a cast or an operator of the database',
      async () => {
        const database = 'hostile';
        await createDatabase(container, database);
        await loadFixture(container, database, 'kitchen-sink');
        const before = await introspectDatabase(database);

        await loadSql(container, database, HOSTILE_OBJECTS);

        // Any query that runs them fails.
        const traps = [
          ["SELECT '42'::pg_catalog.text::pg_catalog.int4", /stack depth/],
          ["SELECT '42'::pg_catalog.text::pg_catalog.int8", /stack depth/],
          [
            "SELECT '42'::pg_catalog.int8::pg_catalog.text",
            /cast of the database/,
          ],
          [
            "SELECT '42'::pg_catalog.oid::pg_catalog.text",
            /cast of the database/,
          ],
          [
            "SELECT 'a'::pg_catalog.text OPERATOR(public.=) 'b'",
            /operator of the database/,
          ],
        ] as const;
        for (const [sql, error] of traps) {
          await expect(catalogQuery(container, database, sql)).rejects.toThrow(
            error
          );
        }

        const after = await introspectDatabase(database);

        expect(
          after.casts.map(
            ({ source, target, method }) => `${source} AS ${target} (${method})`
          )
        ).toEqual(HOSTILE_CASTS);
        expect(
          after.operators
            .filter(({ schema }) => schema === 'public')
            .map(
              ({ name, identityArguments }) => `${name}(${identityArguments})`
            )
        ).toEqual(['=(text, text)']);
        expect(withoutHostileObjects(after)).toEqual(before);
      },
      INTEGRATION_TIMEOUT
    );
  }
);
