import { describe, expect, it } from 'vitest';
import { emitEnum } from '../../../src/codegen/emitters/enums';
import { makeEnum } from '../../introspect/objects';
import { expectCode, expectSql } from '../expectations';
import { emitAndRun } from '../run';

describe('emitEnum', () => {
  it('creates an enum with its labels in order with pgm.createType', () => {
    const result = emitAndRun(
      emitEnum,
      makeEnum('kitchen', 'mood', ['sad', 'meh', 'ok', 'happy', 'ecstatic'])
    );

    expectCode(result);
    expect(result.calls).toStrictEqual(['createType']);
    expectSql(
      result,
      `CREATE TYPE "kitchen"."mood" AS ENUM ('sad', 'meh', 'ok', 'happy', 'ecstatic');`
    );
  });

  it('writes labels that need quotes or escapes exactly', () => {
    const result = emitAndRun(
      emitEnum,
      makeEnum('public', 'tricky', [
        "it's",
        String.raw`back\slash`,
        '$pg1$',
        'a, b',
        'new\nline',
        'Ünïcode 😀',
      ])
    );

    expectCode(result);
    expectSql(
      result,
      `CREATE TYPE "tricky" AS ENUM ('it''s', 'back\\slash', '$pg1$', 'a, b', 'new\nline', 'Ünïcode 😀');`
    );
  });
});
