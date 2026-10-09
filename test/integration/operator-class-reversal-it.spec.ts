import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { runner } from '../../src';
import { quote } from '../../src/utils/quote';
import {
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

const migrationName = '1000000000000_create_operator_class';
const cases = [
  {
    title: 'decamelized mixed-case access method',
    indexMethod: 'myMethod',
    accessMethod: 'my_method',
    decamelize: true,
  },
  {
    title: 'mixed-case access method without decamelization',
    indexMethod: 'myMethod',
    accessMethod: 'myMethod',
    decamelize: false,
  },
  {
    title: 'access method already containing underscores',
    indexMethod: 'custom_method',
    accessMethod: 'custom_method',
    decamelize: true,
  },
  {
    title: 'access method containing a dot',
    indexMethod: 'custom.method',
    accessMethod: 'custom.method',
    decamelize: true,
  },
  {
    title: 'access method containing an embedded quote',
    indexMethod: 'custom"method',
    accessMethod: 'custom"method',
    decamelize: true,
  },
  {
    title: 'built-in btree access method',
    indexMethod: 'btree',
    accessMethod: 'btree',
    decamelize: true,
  },
];

describe.each(PG_VERSIONS)(
  'automatic operator-class reversal (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;
    let dir: string;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'operator_class_reversal'
      );
      client = new pg.Client(container.getConnectionUri());
      await client.connect();
      for (const { accessMethod } of cases) {
        if (accessMethod !== 'btree') {
          await client.query(
            `CREATE ACCESS METHOD ${quote(accessMethod)} TYPE INDEX HANDLER pg_catalog.bthandler`
          );
        }
      }
      await client.query(
        'CREATE ACCESS METHOD mymethod TYPE INDEX HANDLER pg_catalog.bthandler'
      );
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      try {
        if (client) {
          await client.end();
        }
      } finally {
        if (container) {
          await container.stop();
        }
      }
    });

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'pgm-operator-class-reversal-'));
      await client.query('CREATE SCHEMA operator_class_reversal');
    });

    afterEach(async () => {
      try {
        await client.query(
          'DROP SCHEMA IF EXISTS operator_class_reversal CASCADE'
        );
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    async function catalog(name: string) {
      return (
        await client.query<{
          oid: string;
          accessMethod: string;
          accessMethodOid: string;
        }>(
          `SELECT o.oid::text, a.amname AS "accessMethod",
            a.oid::text AS "accessMethodOid"
          FROM pg_opclass o
          JOIN pg_namespace n ON n.oid = o.opcnamespace
          JOIN pg_am a ON a.oid = o.opcmethod
          WHERE n.nspname = 'operator_class_reversal' AND o.opcname = $1
          ORDER BY a.amname`,
          [name]
        )
      ).rows;
    }

    async function history() {
      return (
        await client.query<{ name: string }>(
          'SELECT name FROM operator_class_reversal.pgmigrations'
        )
      ).rows;
    }

    it.each(cases)(
      'creates and removes the same operator class: $title',
      async ({ indexMethod, accessMethod, decamelize }) => {
        const className = decamelize ? 'custom_class' : 'customClass';
        // Operator-class identity includes its access method. The same-named
        // class for hash must survive the automatic down migration unchanged.
        await client.query(
          `CREATE OPERATOR CLASS operator_class_reversal.${quote(className)}
          FOR TYPE integer USING hash AS
          OPERATOR 1 pg_catalog.= (integer, integer),
          FUNCTION 1 pg_catalog.hashint4(integer)`
        );
        if (indexMethod === 'myMethod') {
          // An unquoted myMethod resolves to mymethod. Keep a class with that
          // identity so a wrong reversal succeeds and removes the wrong object.
          await client.query(
            `CREATE OPERATOR CLASS operator_class_reversal.${quote(className)}
            FOR TYPE integer USING mymethod AS
            OPERATOR 1 pg_catalog.< (integer, integer),
            OPERATOR 2 pg_catalog.<= (integer, integer),
            OPERATOR 3 pg_catalog.= (integer, integer),
            OPERATOR 4 pg_catalog.>= (integer, integer),
            OPERATOR 5 pg_catalog.> (integer, integer),
            FUNCTION 1 pg_catalog.btint4cmp(integer, integer)`
          );
        }
        const decoy = await catalog(className);
        const decoyMethods =
          indexMethod === 'myMethod' ? ['hash', 'mymethod'] : ['hash'];
        expect(decoy).toEqual(
          decoyMethods.map((method) => ({
            oid: expect.any(String),
            accessMethod: method,
            accessMethodOid: expect.any(String),
          }))
        );
        const accessMethodOid = (
          await client.query<{ oid: string }>(
            'SELECT oid::text FROM pg_am WHERE amname = $1',
            [accessMethod]
          )
        ).rows[0]?.oid;
        expect(accessMethodOid).toBeDefined();

        await writeFile(
          join(dir, `${migrationName}.mjs`),
          `export function up(pgm) {
            const operators = ['<', '<=', '=', '>=', '>'].map((operator, i) => ({
              type: 'operator', number: i + 1,
              name: pgm.func('pg_catalog.' + operator), params: ['int4', 'int4']
            }));
            pgm.createOperatorClass(
              { schema: 'operator_class_reversal', name: 'customClass' },
              'int4', ${JSON.stringify(indexMethod)},
              [...operators, {
                type: 'function', number: 1,
                name: { schema: 'pg_catalog', name: 'btint4cmp' },
                params: ['int4', 'int4']
              }], {}
            );
          }`
        );

        const options = {
          databaseUrl: container.getConnectionUri(),
          dir,
          schema: 'operator_class_reversal',
          migrationsSchema: 'operator_class_reversal',
          migrationsTable: 'pgmigrations',
          count: 1,
          decamelize,
          log: () => {},
        };

        await runner({ ...options, direction: 'up' });
        const created = await catalog(className);
        const expected = [
          ...decoy,
          {
            oid: expect.any(String),
            accessMethod,
            accessMethodOid,
          },
        ].toSorted((left, right) => {
          if (left.accessMethod === right.accessMethod) {
            return 0;
          }
          return left.accessMethod < right.accessMethod ? -1 : 1;
        });
        expect(created).toEqual(expected);
        expect(await history()).toEqual([{ name: migrationName }]);
        const target = created.find(
          (operatorClass) => operatorClass.accessMethod === accessMethod
        );
        expect(target).toBeDefined();

        await runner({ ...options, direction: 'down' });
        expect(await catalog(className)).toEqual(decoy);
        expect(
          (
            await client.query('SELECT oid FROM pg_opclass WHERE oid = $1', [
              target?.oid,
            ])
          ).rows
        ).toEqual([]);
        expect(await history()).toEqual([]);
      }
    );
  }
);
