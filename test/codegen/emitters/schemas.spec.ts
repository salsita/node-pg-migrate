import { describe, expect, it } from 'vitest';
import { emitSchema } from '../../../src/codegen/emitters/schemas';
import { makeSchema } from '../../introspect/objects';
import { expectCode, expectSql } from '../expectations';
import { emitAndRun } from '../run';

describe('emitSchema', () => {
  it.each([
    ['kitchen', 'CREATE SCHEMA IF NOT EXISTS "kitchen";'],
    ['Sink Área', 'CREATE SCHEMA IF NOT EXISTS "Sink Área";'],
    ['public', 'CREATE SCHEMA IF NOT EXISTS "public";'],
  ])(
    'creates schema %s with pgm.createSchema, if it does not exist',
    (name, expected) => {
      const result = emitAndRun(
        emitSchema,
        makeSchema(name, { comment: 'Set by a comment step' })
      );

      expectCode(result);
      expect(result.calls).toStrictEqual(['createSchema']);
      expectSql(result, expected);
    }
  );
});
