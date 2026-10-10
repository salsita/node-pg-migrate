import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  AlterPolicy,
  CreatePolicy,
  Name,
  PolicyOptions,
} from '../../../src';
import { PgLiteral } from '../../../src';
import { alterPolicy, createPolicy } from '../../../src/operations/policies';
import {
  options1,
  options1Pretty,
  options2,
} from '../../presetMigrationOptions';

describe('policy comments', () => {
  it('preserves public string return types and exposes nullable comments', () => {
    expectTypeOf<ReturnType<CreatePolicy>>().toEqualTypeOf<string>();
    expectTypeOf<ReturnType<AlterPolicy>>().toEqualTypeOf<string>();
    expectTypeOf<PolicyOptions['comment']>().toEqualTypeOf<
      string | null | undefined
    >();
  });

  it.each([
    ['plain table', 'records', '"records"'],
    ['schema', { schema: 'app', name: 'records' }, '"app"."records"'],
    [
      'quoted names',
      { schema: 'app.schema', name: 'record"表' },
      '"app.schema"."record""表"',
    ],
    ['raw name', new PgLiteral('app.records'), 'app.records'],
  ] satisfies Array<[string, Name, string]>)(
    'quotes policy comments on %s',
    (_, table, name) => {
      const comment = `COMMENT ON POLICY "policy""名" ON ${name} IS $pga$説明$pga$;`;
      expect(
        createPolicy(options1)(table, 'policy"名', { comment: '説明' })
      ).toBe(
        `CREATE POLICY "policy""名" ON ${name} FOR ALL TO PUBLIC;\n${comment}`
      );
      expect(
        alterPolicy(options1)(table, 'policy"名', { comment: '説明' })
      ).toBe(comment);
    }
  );

  it.each([
    ['string', 'description', '$pga$description$pga$'],
    ['null', null, 'NULL'],
    ['empty string', '', '$pga$$pga$'],
    [
      'quotes and newlines',
      "quote '資料'\nnext line",
      "$pga$quote '資料'\nnext line$pga$",
    ],
    ['dollar delimiter collision', '$pga$ and $$', '$pgb$$pga$ and $$$pgb$'],
    ['dollar suffix', 'text$pga', '$pgb$text$pga$pgb$'],
  ] satisfies Array<[string, string | null, string]>)(
    'renders %s without discarding the comment',
    (_, comment, value) => {
      const sql = `COMMENT ON POLICY "p1" ON "records" IS ${value};`;
      expect(createPolicy(options1)('records', 'p1', { comment })).toBe(
        `CREATE POLICY "p1" ON "records" FOR ALL TO PUBLIC;\n${sql}`
      );
      expect(alterPolicy(options1)('records', 'p1', { comment })).toBe(sql);
    }
  );

  it.each([options1, options1Pretty])(
    'places comments after the policy statement (pretty: $pretty)',
    (options) => {
      const settings: PolicyOptions = {
        role: 'reader',
        using: 'id > 0',
        check: 'id < 10',
        comment: 'limited rows',
      };
      expect(
        createPolicy(options)('records', 'p1', {
          ...settings,
          as: 'RESTRICTIVE',
        })
      ).toBe(
        'CREATE POLICY "p1" ON "records" AS RESTRICTIVE FOR ALL TO reader USING (id > 0) WITH CHECK (id < 10);\nCOMMENT ON POLICY "p1" ON "records" IS $pga$limited rows$pga$;'
      );
      expect(alterPolicy(options)('records', 'p1', settings)).toBe(
        'ALTER POLICY "p1" ON "records" TO reader USING (id > 0) WITH CHECK (id < 10);\nCOMMENT ON POLICY "p1" ON "records" IS $pga$limited rows$pga$;'
      );
    }
  );

  it('decamelizes policy, schema, and table names', () => {
    expect(
      alterPolicy(options2)(
        { schema: 'appSchema', name: 'myTable' },
        'myPolicy',
        { comment: 'note' }
      )
    ).toBe(
      'COMMENT ON POLICY "my_policy" ON "app_schema"."my_table" IS $pga$note$pga$;'
    );
  });

  it('omits undefined comments and preserves the empty-options error', () => {
    expect(
      createPolicy(options1)('records', 'p1', { comment: undefined })
    ).toBe('CREATE POLICY "p1" ON "records" FOR ALL TO PUBLIC;');
    expect(
      alterPolicy(options1)('records', 'p1', {
        using: 'true',
        comment: undefined,
      })
    ).toBe('ALTER POLICY "p1" ON "records" USING (true);');
    expect(() =>
      alterPolicy(options1)('records', 'p1', { comment: undefined })
    ).toThrow('No policy options provided for alterPolicy');
  });

  it('drops a commented policy during automatic reversal', () => {
    expect(
      createPolicy(options1).reverse({ schema: 'app', name: 'records' }, 'p1', {
        comment: 'note',
        ifExists: true,
      })
    ).toBe('DROP POLICY IF EXISTS "p1" ON "app"."records";');
  });
});
