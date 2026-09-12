import { describe, expect, it } from 'vitest';
import { emitRowLevelSecurity } from '../../../src/codegen/emitters/rowLevelSecurity';
import { makeTable } from '../../introspect/objects';
import { expectCode, expectSql } from '../expectations';
import { emitAndRun } from '../run';

describe('emitRowLevelSecurity', () => {
  it('enables row-level security with pgm.alterTable', () => {
    const result = emitAndRun(
      emitRowLevelSecurity,
      makeTable('public', 'documents', { rowLevelSecurity: true })
    );

    expectCode(result);
    expect(result.calls).toStrictEqual(['alterTable']);
    expectSql(result, 'ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;');
  });

  it('enables, then forces row-level security', () => {
    const result = emitAndRun(
      emitRowLevelSecurity,
      makeTable('kitchen', 'documents', {
        rowLevelSecurity: true,
        forceRowLevelSecurity: true,
      })
    );

    expectCode(result);
    expect(result.calls).toStrictEqual(['alterTable', 'alterTable']);
    expectSql(
      result,
      `ALTER TABLE "kitchen"."documents" ENABLE ROW LEVEL SECURITY;
       ALTER TABLE "kitchen"."documents" FORCE ROW LEVEL SECURITY;`
    );
  });

  it('forces row-level security that is not enabled', () => {
    const result = emitAndRun(
      emitRowLevelSecurity,
      makeTable('kitchen', 'documents', { forceRowLevelSecurity: true })
    );

    expectCode(result);
    expectSql(
      result,
      'ALTER TABLE "kitchen"."documents" FORCE ROW LEVEL SECURITY;'
    );
  });
});
