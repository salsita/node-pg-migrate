import { describe, expect, it } from 'vitest';
import type { Name } from '../../../src';
import { PgLiteral } from '../../../src';
import { alterPolicy } from '../../../src/operations/policies';
import {
  options1,
  options1Pretty,
  options2,
} from '../../presetMigrationOptions';

describe('operations', () => {
  describe('policies', () => {
    describe('alterPolicy', () => {
      const alterPolicyFn = alterPolicy(options1);

      it('should return a function', () => {
        expect(alterPolicyFn).toBeTypeOf('function');
      });

      it('should throw error when no policy options are provided', () => {
        expect(() => alterPolicyFn('my_table', 'p1', {})).toThrow(
          new Error('No policy options provided for alterPolicy')
        );
      });

      it('should return sql statement with policyOptions', () => {
        const statement = alterPolicyFn('my_table', 'p1', {
          role: 'CURRENT_USER',
          check: 'true',
          using: 'true',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'ALTER POLICY "p1" ON "my_table" TO CURRENT_USER USING (true) WITH CHECK (true);'
        );
      });

      describe('comments', () => {
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
            expect(alterPolicyFn(table, 'policy"名', { comment: '説明' })).toBe(
              `COMMENT ON POLICY "policy""名" ON ${name} IS $pga$説明$pga$;`
            );
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
          [
            'dollar delimiter collision',
            '$pga$ and $$',
            '$pgb$$pga$ and $$$pgb$',
          ],
          ['dollar suffix', 'text$pga', '$pgb$text$pga$pgb$'],
        ] satisfies Array<[string, string | null, string]>)(
          'renders %s without discarding the comment',
          (_, comment, value) => {
            expect(alterPolicyFn('records', 'p1', { comment })).toBe(
              `COMMENT ON POLICY "p1" ON "records" IS ${value};`
            );
          }
        );

        it.each([options1, options1Pretty])(
          'places comments after the policy statement (pretty: $pretty)',
          (options) => {
            expect(
              alterPolicy(options)('records', 'p1', {
                role: 'reader',
                using: 'id > 0',
                check: 'id < 10',
                comment: 'limited rows',
              })
            ).toBe(
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
            alterPolicyFn('records', 'p1', {
              using: 'true',
              comment: undefined,
            })
          ).toBe('ALTER POLICY "p1" ON "records" USING (true);');
          expect(() =>
            alterPolicyFn('records', 'p1', { comment: undefined })
          ).toThrow('No policy options provided for alterPolicy');
        });
      });
    });
  });
});
