import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
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
import type { FunctionParam, Name } from '../../src';
import { MigrationBuilder, PgLiteral } from '../../src';
import { db } from '../../src/db';
import { quote } from '../../src/utils/quote';
import {
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

type Rename = (pgm: MigrationBuilder, source: Name, destination: Name) => void;

const operations: Array<{
  operation: 'renameFunction' | 'renameOperatorClass' | 'renameOperatorFamily';
  identity: string;
  otherIdentity: string;
  indexMethod?: string;
  params?: FunctionParam[];
}> = [
  {
    operation: 'renameFunction',
    identity: '',
    otherIdentity: 'text',
    params: [],
  },
  {
    operation: 'renameFunction',
    identity: 'integer',
    otherIdentity: 'text',
    params: ['integer'],
  },
  {
    operation: 'renameFunction',
    identity: 'integer, text',
    otherIdentity: 'text',
    params: [
      { mode: 'IN', name: 'inputValue', type: 'integer' },
      { mode: 'IN', name: 'otherValue', type: 'text' },
    ],
  },
  {
    operation: 'renameOperatorClass',
    identity: 'btree',
    otherIdentity: 'hash',
  },
  {
    operation: 'renameOperatorClass',
    identity: 'hash',
    otherIdentity: 'btree',
  },
  {
    operation: 'renameOperatorFamily',
    identity: 'btree',
    otherIdentity: 'hash',
  },
  {
    operation: 'renameOperatorFamily',
    identity: 'hash',
    otherIdentity: 'btree',
  },
  {
    operation: 'renameOperatorClass',
    identity: 'Custom.Method',
    otherIdentity: 'hash',
    indexMethod: '"Custom.Method"',
  },
  {
    operation: 'renameOperatorFamily',
    identity: 'Custom.Method',
    otherIdentity: 'hash',
    indexMethod: '"Custom.Method"',
  },
];

const scenarios: Array<{
  title: string;
  original: string;
  final: string;
  qualified: boolean;
  migrate: (pgm: MigrationBuilder, rename: Rename) => void;
}> = [
  {
    title: 'rendered schema equality and empty destination in a rename chain',
    original: 'old_name',
    final: 'new_name',
    qualified: true,
    migrate: (pgm, rename) => {
      rename(
        pgm,
        { schema: 'appSchema', name: 'oldName' },
        { schema: 'app_schema', name: 'middleName' }
      );
      rename(
        pgm,
        { schema: 'app_schema', name: 'middleName' },
        { schema: '', name: 'newName' }
      );
    },
  },
  {
    title: 'empty and omitted schemas in both argument orders',
    original: 'old_name',
    final: 'new_name',
    qualified: false,
    migrate: (pgm, rename) => {
      rename(pgm, { schema: '', name: 'oldName' }, { name: 'middleName' });
      rename(pgm, { name: 'middleName' }, { schema: '', name: 'newName' });
    },
  },
  {
    title: 'quoted raw destination with dots, escaped quotes and whitespace',
    original: 'old_name',
    final: 'New.Name"Quoted',
    qualified: true,
    migrate: (pgm, rename) => {
      rename(
        pgm,
        { schema: 'appSchema', name: 'oldName' },
        PgLiteral.create(' \t"New.Name""Quoted"\n')
      );
    },
  },
  {
    title: 'unquoted raw destination preserves PostgreSQL case folding',
    original: 'old_name',
    final: 'newname',
    qualified: true,
    migrate: (pgm, rename) => {
      rename(
        pgm,
        { schema: 'appSchema', name: 'oldName' },
        PgLiteral.create('NewName')
      );
    },
  },
  {
    title: 'unqualified raw source during automatic reversal',
    original: 'oldname',
    final: 'new_name',
    qualified: false,
    migrate: (pgm, rename) => {
      rename(pgm, PgLiteral.create('OldName'), 'newName');
    },
  },
];

describe.each(PG_VERSIONS)(
  'schema-aware rename identities (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${version}-alpine`,
        'rename_identities'
      );
      client = new pg.Client(container.getConnectionUri());
      await client.connect();
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      if (client) {
        await client.end();
      }
      if (container) {
        await container.stop();
      }
    });

    beforeEach(async () => {
      await client.query('BEGIN');
      await client.query(
        'CREATE SCHEMA app_schema; CREATE SCHEMA decoy_schema'
      );
    });

    afterEach(async () => {
      await client.query('ROLLBACK');
    });

    describe.each(operations)(
      '$operation ($identity)',
      ({ operation, identity, otherIdentity, params, indexMethod }) => {
        const rename: Rename = (pgm, source, destination) => {
          if (operation === 'renameFunction') {
            pgm.renameFunction(source, params ?? [], destination);
          } else {
            pgm[operation](source, indexMethod ?? identity, destination);
          }
        };

        it.each(scenarios)(
          '$title',
          async ({ original, final, qualified, migrate }) => {
            if (indexMethod) {
              await client.query(
                'CREATE ACCESS METHOD "Custom.Method" TYPE INDEX HANDLER pg_catalog.bthandler'
              );
            }
            // Qualified calls must bypass the first search-path entry. Other
            // overloads/access methods must also survive every rename unchanged.
            await client.query(
              qualified
                ? 'SET LOCAL search_path TO decoy_schema, app_schema'
                : 'SET LOCAL search_path TO app_schema, decoy_schema'
            );

            async function createObject(
              schema: string,
              name: string,
              objectIdentity: string
            ) {
              const qualifiedName = `${quote(schema)}.${quote(name)}`;
              if (operation === 'renameFunction') {
                await client.query(
                  `CREATE FUNCTION ${qualifiedName}(${objectIdentity}) RETURNS integer LANGUAGE SQL AS 'SELECT 1'`
                );
              } else if (operation === 'renameOperatorFamily') {
                await client.query(
                  `CREATE OPERATOR FAMILY ${qualifiedName} USING ${quote(objectIdentity)}`
                );
              } else {
                const definition =
                  objectIdentity === 'hash'
                    ? 'OPERATOR 1 pg_catalog.= (integer, integer), FUNCTION 1 pg_catalog.hashint4(integer)'
                    : `OPERATOR 1 pg_catalog.< (integer, integer),
                 OPERATOR 2 pg_catalog.<= (integer, integer),
                 OPERATOR 3 pg_catalog.= (integer, integer),
                 OPERATOR 4 pg_catalog.>= (integer, integer),
                 OPERATOR 5 pg_catalog.> (integer, integer),
                 FUNCTION 1 pg_catalog.btint4cmp(integer, integer)`;
                await client.query(
                  `CREATE OPERATOR CLASS ${qualifiedName} FOR TYPE integer USING ${quote(objectIdentity)} AS ${definition}`
                );
              }
            }

            async function objects(schema: string) {
              const catalog =
                operation === 'renameFunction'
                  ? 'pg_proc'
                  : operation === 'renameOperatorClass'
                    ? 'pg_opclass'
                    : 'pg_opfamily';
              const prefix =
                operation === 'renameFunction'
                  ? 'pro'
                  : operation === 'renameOperatorClass'
                    ? 'opc'
                    : 'opf';
              const identitySql =
                operation === 'renameFunction'
                  ? 'pg_catalog.oidvectortypes(o.proargtypes)'
                  : 'a.amname';
              const accessMethodJoin =
                operation === 'renameFunction'
                  ? ''
                  : `JOIN pg_am a ON a.oid = o.${prefix}method`;
              const result = await client.query<{
                name: string;
                oid: string;
                identity: string;
              }>(
                `SELECT o.${prefix}name AS name, o.oid::text AS oid, ${identitySql} AS identity
             FROM ${catalog} o JOIN pg_namespace n ON n.oid = o.${prefix}namespace
             ${accessMethodJoin}
             WHERE n.nspname = $1 AND o.${prefix}name = ANY($2::text[])
             ORDER BY name, identity`,
                [schema, [original, 'middle_name', final]]
              );
              return result.rows;
            }

            await createObject('app_schema', original, identity);
            for (const name of [original, 'middle_name', final]) {
              await createObject('decoy_schema', name, identity);
              await createObject('app_schema', name, otherIdentity);
            }
            const before = await objects('app_schema');
            const decoys = await objects('decoy_schema');
            const target = before.find(
              (object) => object.identity === identity
            );
            expect(before).toHaveLength(4);
            expect(decoys).toHaveLength(3);
            expect(target).toBeDefined();

            const up = new MigrationBuilder(
              db(client),
              undefined,
              true,
              console
            );
            migrate(up, rename);
            for (const sql of up.getSqlSteps()) {
              await client.query(sql);
            }
            const after = await objects('app_schema');
            expect(after).toHaveLength(4);
            expect(
              after.filter((object) => object.identity === identity)
            ).toEqual([{ name: final, oid: target?.oid, identity }]);
            expect(
              after.filter((object) => object.identity === otherIdentity)
            ).toEqual(
              before.filter((object) => object.identity === otherIdentity)
            );
            expect(await objects('decoy_schema')).toEqual(decoys);

            const down = new MigrationBuilder(
              db(client),
              undefined,
              true,
              console
            );
            down.enableReverseMode();
            migrate(down, rename);
            for (const sql of down.getSqlSteps()) {
              await client.query(sql);
            }
            expect(await objects('app_schema')).toEqual(before);
            expect(await objects('decoy_schema')).toEqual(decoys);
          }
        );
      }
    );
  }
);
