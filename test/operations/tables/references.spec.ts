import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Name, Reference, ReferencesOptions } from '../../../src';
import { PgLiteral } from '../../../src';
import {
  addColumns,
  addConstraint,
  createTable,
} from '../../../src/operations/tables';
import { parseReferences } from '../../../src/operations/tables/shared';
import {
  options1,
  options1Pretty,
  options2,
} from '../../presetMigrationOptions';

describe('foreign key references', () => {
  it('exports a reference type compatible with existing names', () => {
    expectTypeOf<Name>().toExtend<Reference>();
    expectTypeOf<ReferencesOptions['references']>().toEqualTypeOf<Reference>();
  });

  it.each([
    ['string', 'parents', 'REFERENCES "parents"'],
    ['prequoted string', '"app"."parents"', 'REFERENCES "app"."parents"'],
    ['raw column list', 'app.parents (code)', 'REFERENCES app.parents (code)'],
    [
      'literal',
      new PgLiteral('app.parents (code)'),
      'REFERENCES app.parents (code)',
    ],
    [
      'literal with additional identifier properties',
      Object.assign(new PgLiteral('app.parents (code)'), {
        name: 'ignored',
        columns: ['ignored'],
      }),
      'REFERENCES app.parents (code)',
    ],
    [
      'literal value',
      {
        literal: true,
        value: 'app.parents (code)',
        toString: () => 'app.parents (code)',
      },
      'REFERENCES app.parents (code)',
    ],
    ['name object', { name: 'parents' }, 'REFERENCES "parents"'],
    [
      'schema',
      { schema: 'app', name: 'parents' },
      'REFERENCES "app"."parents"',
    ],
    [
      'undefined columns',
      { name: 'parents', columns: undefined },
      'REFERENCES "parents"',
    ],
    ['empty columns', { name: 'parents', columns: [] }, 'REFERENCES "parents"'],
    [
      'single column',
      { name: 'parents', columns: 'code' },
      'REFERENCES "parents" ("code")',
    ],
    [
      'column array',
      { name: 'parents', columns: ['code'] },
      'REFERENCES "parents" ("code")',
    ],
    [
      'composite columns',
      { schema: 'app', name: 'parents', columns: ['tenant', 'code'] },
      'REFERENCES "app"."parents" ("tenant", "code")',
    ],
    [
      'quoted identifiers',
      {
        schema: 'a.b',
        name: 'parent"表',
        columns: ['part.one', 'part-two', 'part"三'],
      },
      'REFERENCES "a.b"."parent""表" ("part.one", "part-two", "part""三")',
    ],
    [
      'empty identifier',
      { name: 'parents', columns: ['', 'code'] },
      'REFERENCES "parents" ("", "code")',
    ],
  ] satisfies Array<[string, Reference, string]>)(
    '%s',
    (_, references, sql) => {
      expect(parseReferences({ references }, options1.literal)).toBe(sql);
    }
  );

  it('decamelizes table, schema, and column names and preserves column order', () => {
    expect(
      parseReferences(
        {
          references: {
            schema: 'appSchema',
            name: 'parentTable',
            columns: ['tenantId', 'parentCode'],
          },
          match: 'FULL',
          onDelete: 'CASCADE',
          onUpdate: 'RESTRICT',
        },
        options2.literal
      )
    ).toBe(
      'REFERENCES "app_schema"."parent_table" ("tenant_id", "parent_code") MATCH FULL ON DELETE CASCADE ON UPDATE RESTRICT'
    );
  });

  it.each([options1, options1Pretty])(
    'creates explicit column and composite references with comments (pretty: $pretty)',
    (options) => {
      const sql = createTable(options)(
        'children',
        {
          parent_code: {
            type: 'text',
            references: { name: 'parents', columns: 'code' },
            referencesConstraintName: 'code_fk',
            referencesConstraintComment: 'column reference',
          },
          tenant: 'integer',
        },
        {
          constraints: {
            foreignKeys: {
              columns: ['tenant', 'parent_code'],
              references: {
                schema: 'app',
                name: 'parents',
                columns: ['tenant', 'code'],
              },
              referencesConstraintName: 'pair_fk',
              referencesConstraintComment: 'composite reference',
            },
            deferrable: true,
            deferred: true,
          },
        }
      );
      expect(sql).toContain(
        '"parent_code" text CONSTRAINT "code_fk" REFERENCES "parents" ("code")'
      );
      expect(sql).toContain(
        'CONSTRAINT "pair_fk" FOREIGN KEY ("tenant", "parent_code") REFERENCES "app"."parents" ("tenant", "code")'
      );
      expect(sql).toContain(
        'COMMENT ON CONSTRAINT "code_fk" ON "children" IS $pga$column reference$pga$;'
      );
      expect(sql).toContain(
        'COMMENT ON CONSTRAINT "pair_fk" ON "children" IS $pga$composite reference$pga$;'
      );
      expect(sql).toContain('DEFERRABLE INITIALLY DEFERRED');
    }
  );

  it('applies references from recursive type shorthands', () => {
    expect(
      createTable({
        ...options2,
        typeShorthands: {
          code: { type: 'text', onDelete: 'CASCADE' },
          parentCode: {
            type: 'code',
            references: { name: 'parentTable', columns: 'parentCode' },
          },
        },
      })('children', { parentCode: 'parentCode' })
    ).toBe(
      'CREATE TABLE "children" ("parent_code" text REFERENCES "parent_table" ("parent_code") ON DELETE CASCADE);'
    );
  });

  it('supports adding columns and constraints without mutating the reference', () => {
    const columns = ['tenant', 'code'];
    const references: Reference = { schema: 'app', name: 'parents', columns };
    const before = structuredClone(references);
    expect(
      addColumns(options1)('children', {
        code: {
          type: 'text',
          references: { name: 'parents', columns: 'code' },
        },
      })
    ).toBe(
      'ALTER TABLE "children" ADD "code" text REFERENCES "parents" ("code");'
    );
    expect(
      addConstraint(options1)('children', 'pair_fk', {
        foreignKeys: { columns: ['parent_tenant', 'parent_code'], references },
      })
    ).toBe(
      'ALTER TABLE "children" ADD CONSTRAINT "pair_fk" FOREIGN KEY ("parent_tenant", "parent_code") REFERENCES "app"."parents" ("tenant", "code");'
    );
    expect(references).toEqual(before);
    expect(columns).toEqual(['tenant', 'code']);
  });
});
