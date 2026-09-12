import { describe, expect, it } from 'vitest';
import {
  emitSequence,
  emitSequenceOwnership,
} from '../../../src/codegen/emitters/sequences';
import type { SequenceOptions } from '../../../src/introspect/types';
import { defaultSequenceOptions, makeSequence } from '../../introspect/objects';
import {
  expectCode,
  expectFallback,
  expectSql,
  expectSqlOneOf,
} from '../expectations';
import { emitAndRun } from '../run';

describe('emitSequence', () => {
  it('creates a sequence with pgm.createSequence, leaving out the default options', () => {
    const result = emitAndRun(
      emitSequence,
      makeSequence('public', 'ticket_seq', { comment: 'Set by a comment step' })
    );

    expectCode(result);
    expect(result.calls).toStrictEqual(['createSequence']);
    expect(result.steps).toStrictEqual(['CREATE SEQUENCE "ticket_seq";']);
  });

  it.each<[string, Partial<SequenceOptions>, string]>([
    [
      'a smallint sequence',
      defaultSequenceOptions('smallint'),
      'CREATE SEQUENCE "s" AS smallint;',
    ],
    [
      'a descending sequence',
      { increment: '-1', minValue: '-1000', maxValue: '-1', start: '-1' },
      'CREATE SEQUENCE "s" INCREMENT BY -1 MINVALUE -1000;',
    ],
    [
      'a descending sequence with the bounds of its type',
      {
        increment: '-1',
        minValue: '-9223372036854775808',
        maxValue: '-1',
        start: '-1',
      },
      'CREATE SEQUENCE "s" INCREMENT BY -1;',
    ],
    [
      'a sequence that ends at the largest safe integer',
      { maxValue: '9007199254740991', start: '9007199254740991' },
      'CREATE SEQUENCE "s" MAXVALUE 9007199254740991 START WITH 9007199254740991;',
    ],
    [
      'a sequence with every option set',
      {
        ...defaultSequenceOptions('integer'),
        start: '1005',
        increment: '10',
        minValue: '1000',
        maxValue: '999990',
        cache: '5',
        cycle: true,
      },
      'CREATE SEQUENCE "s" AS integer INCREMENT BY 10 MINVALUE 1000 MAXVALUE 999990 START WITH 1005 CACHE 5 CYCLE;',
    ],
  ])('leaves out the defaults of %s', (_, options, expected) => {
    const result = emitAndRun(
      emitSequence,
      makeSequence('public', 's', options)
    );

    expectCode(result);
    expect(result.steps).toStrictEqual([expected]);
  });

  it('writes the schema of a sequence that is not in the default schema', () => {
    const result = emitAndRun(
      emitSequence,
      makeSequence('kitchen', 'invoice_number', { start: '5' })
    );

    expectCode(result);
    expect(result.steps).toStrictEqual([
      'CREATE SEQUENCE "kitchen"."invoice_number" START WITH 5;',
    ]);
  });

  it('falls back to CREATE UNLOGGED SEQUENCE for an unlogged sequence', () => {
    const result = emitAndRun(
      emitSequence,
      makeSequence('kitchen', 'cache_seq', { unlogged: true, cache: '10' })
    );

    expectFallback(result, 'unlogged sequence');
    expect(result.calls).toStrictEqual(['sql']);
    expectSql(
      result,
      'CREATE UNLOGGED SEQUENCE "kitchen"."cache_seq" CACHE 10;'
    );
  });

  it.each<[string, Partial<SequenceOptions>, string]>([
    [
      'a start',
      { start: '9007199254740992' },
      'CREATE SEQUENCE "kitchen"."big" START WITH 9007199254740992;',
    ],
    [
      'a maximum',
      { maxValue: '9007199254740993' },
      'CREATE SEQUENCE "kitchen"."big" MAXVALUE 9007199254740993;',
    ],
    [
      'a negative minimum',
      {
        increment: '-1',
        minValue: '-9007199254740993',
        maxValue: '-1',
        start: '-1',
      },
      'CREATE SEQUENCE "kitchen"."big" INCREMENT BY -1 MINVALUE -9007199254740993;',
    ],
  ])(
    'falls back to CREATE SEQUENCE for %s beyond the safe integers',
    (_, options, expected) => {
      const result = emitAndRun(
        emitSequence,
        makeSequence('kitchen', 'big', options)
      );

      expectFallback(result, 'bigint option');
      expect(result.calls).toStrictEqual(['sql']);
      expectSql(result, expected);
    }
  );
});

describe('emitSequenceOwnership', () => {
  it('sets the owner of a sequence with pgm.alterSequence', () => {
    const result = emitAndRun(
      emitSequenceOwnership,
      makeSequence('kitchen', 'ticket_seq', {
        ownedBy: {
          table: { schema: 'kitchen', name: 'orders' },
          column: 'ticket_no',
        },
      })
    );

    expectCode(result);
    expect(result.calls).toStrictEqual(['alterSequence']);
    expectSql(
      result,
      'ALTER SEQUENCE "kitchen"."ticket_seq" OWNED BY kitchen.orders.ticket_no;'
    );
  });

  it('quotes the owner when its names need quotes', () => {
    const result = emitAndRun(
      emitSequenceOwnership,
      makeSequence('Sink Área', 'Order; Lines_Id_seq', {
        ownedBy: {
          table: { schema: 'Sink Área', name: 'Order; Lines' },
          column: 'Id',
        },
      })
    );

    expectCode(result);
    expectSql(
      result,
      'ALTER SEQUENCE "Sink Área"."Order; Lines_Id_seq" OWNED BY "Sink Área"."Order; Lines"."Id";'
    );
  });

  it('sets the owner of a sequence of the default schema', () => {
    const result = emitAndRun(
      emitSequenceOwnership,
      makeSequence('public', 'order_seq', {
        ownedBy: { table: { schema: 'public', name: 'orders' }, column: 'id' },
      })
    );

    expectCode(result);
    expectSqlOneOf(result, [
      'ALTER SEQUENCE "order_seq" OWNED BY public.orders.id;',
      'ALTER SEQUENCE "order_seq" OWNED BY orders.id;',
    ]);
  });
});
