import { describe, expect, it } from 'vitest';
import { emitCollation } from '../../../src/codegen/emitters/collations';
import { emitComposite } from '../../../src/codegen/emitters/composites';
import { emitDomain } from '../../../src/codegen/emitters/domains';
import { emitRange } from '../../../src/codegen/emitters/ranges';
import {
  emitSequence,
  emitSequenceOwnership,
} from '../../../src/codegen/emitters/sequences';
import { emitShellType } from '../../../src/codegen/emitters/types';
import type { SequenceOptions, ShellType } from '../../../src/introspect/types';
import {
  makeCollation,
  makeComposite,
  makeDomain,
  makeRange,
  makeSequence,
  nextOid,
} from '../../introspect/objects';
import { expectCode, expectFallback, expectSql } from '../expectations';
import { emitAndRun } from '../run';

// What the type and sequence emitters cannot write with `pgm` operations
// (CONTRACT-TS.md §11), and the settings the frozen specs leave out.

describe('emitSequence', () => {
  it.each<[string, Partial<SequenceOptions>, string]>([
    [
      'a minimum of 0',
      { minValue: '0', start: '0' },
      'CREATE SEQUENCE "kitchen"."s" MINVALUE 0;',
    ],
    [
      'a maximum of 0',
      { increment: '-1', minValue: '-100', maxValue: '0', start: '0' },
      'CREATE SEQUENCE "kitchen"."s" INCREMENT BY -1 MINVALUE -100 MAXVALUE 0;',
    ],
    [
      'a start of 0',
      { minValue: '-10', start: '0' },
      'CREATE SEQUENCE "kitchen"."s" MINVALUE -10 START WITH 0;',
    ],
  ])(
    'falls back to CREATE SEQUENCE for %s, which createSequence would leave out',
    (_, options, expected) => {
      const result = emitAndRun(
        emitSequence,
        makeSequence('kitchen', 's', options)
      );

      expectFallback(result, 'zero option');
      expect(result.calls).toStrictEqual(['sql']);
      expectSql(result, expected);
    }
  );

  it('gives every reason of an unlogged sequence with a bigint start and a zero minimum', () => {
    const result = emitAndRun(
      emitSequence,
      makeSequence('kitchen', 's', {
        type: 'integer',
        unlogged: true,
        minValue: '0',
        maxValue: '9007199254740993',
        start: '0',
        cycle: true,
      })
    );

    expectFallback(result, 'unlogged sequence', 'bigint option', 'zero option');
    expectSql(
      result,
      'CREATE UNLOGGED SEQUENCE "kitchen"."s" AS integer MINVALUE 0 MAXVALUE 9007199254740993 CYCLE;'
    );
  });

  it('writes OWNED BY NONE for a sequence without an owner', () => {
    const result = emitAndRun(
      emitSequenceOwnership,
      makeSequence('kitchen', 's')
    );

    expectSql(result, 'ALTER SEQUENCE "kitchen"."s" OWNED BY NONE;');
  });

  it('quotes an owner whose schema is a keyword', () => {
    const result = emitAndRun(
      emitSequenceOwnership,
      makeSequence('user', 's', {
        ownedBy: { table: { schema: 'user', name: 'order' }, column: 'select' },
      })
    );

    expect(result.emitted.code).toContain(`owner: '"user"."order"."select"'`);
    expectSql(
      result,
      'ALTER SEQUENCE "user"."s" OWNED BY "user"."order"."select";'
    );
  });
});

describe('emitComposite', () => {
  it('falls back to CREATE TYPE when an object would reorder integer-like attribute names', () => {
    const result = emitAndRun(
      emitComposite,
      makeComposite('kitchen', 'pair', [
        { name: 'b', type: 'text' },
        { name: '1', type: 'integer' },
      ])
    );

    expectFallback(result, 'attribute order');
    expectSql(
      result,
      'CREATE TYPE "kitchen"."pair" AS ("b" text, "1" integer);'
    );
  });

  it('keeps integer-like attribute names that are already in object order', () => {
    const result = emitAndRun(
      emitComposite,
      makeComposite('kitchen', 'pair', [
        { name: '1', type: 'integer' },
        { name: '__proto__', type: 'text' },
      ])
    );

    expectCode(result);
    expectSql(
      result,
      'CREATE TYPE "kitchen"."pair" AS ("1" integer, "__proto__" text);'
    );
  });

  it('gives both reasons of a composite type', () => {
    const result = emitAndRun(
      emitComposite,
      makeComposite('kitchen', 'pair', [
        { name: 'b', type: 'text', collation: 'pg_catalog."C"' },
        { name: '1', type: 'integer' },
      ])
    );

    expectFallback(result, 'attribute collation', 'attribute order');
  });
});

describe('emitDomain', () => {
  it('names a NOT NULL constraint that does not have the default name (PostgreSQL 17+)', () => {
    const result = emitAndRun(
      emitDomain,
      makeDomain('kitchen', 'required', 'integer', {
        notNull: true,
        notNullConstraintName: 'required_is_set',
      })
    );

    expectCode(result);
    expectSql(
      result,
      'CREATE DOMAIN "kitchen"."required" AS integer CONSTRAINT "required_is_set" NOT NULL;'
    );
  });

  it('leaves out the default name of a NOT NULL constraint', () => {
    const result = emitAndRun(
      emitDomain,
      makeDomain('kitchen', 'required', 'integer', {
        notNull: true,
        notNullConstraintName: 'required_not_null',
      })
    );

    expectCode(result);
    expectSql(
      result,
      'CREATE DOMAIN "kitchen"."required" AS integer NOT NULL;'
    );
  });

  it('adds a CHECK that is not valid with ALTER DOMAIN … NOT VALID', () => {
    const result = emitAndRun(
      emitDomain,
      makeDomain('kitchen', 'pct', 'integer', {
        checks: [
          { name: 'pct_max', expression: '(VALUE <= 100)', validated: false },
        ],
      })
    );

    expectFallback(result, 'NOT VALID constraint');
    expect(result.calls).toStrictEqual(['createDomain', 'sql']);
    expectSql(
      result,
      `CREATE DOMAIN "kitchen"."pct" AS integer;
       ALTER DOMAIN "kitchen"."pct" ADD CONSTRAINT "pct_max" CHECK ((VALUE <= 100)) NOT VALID;`
    );
  });

  it('gives both reasons of a NOT NULL domain with a CHECK that is not valid', () => {
    const result = emitAndRun(
      emitDomain,
      makeDomain('kitchen', 'pct', 'integer', {
        notNull: true,
        checks: [
          { name: 'pct_max', expression: '(VALUE <= 100)', validated: false },
        ],
      })
    );

    expectFallback(result, 'several constraints', 'NOT VALID constraint');
  });
});

describe('emitCollation', () => {
  it('writes the provider alone when the collation has no locale', () => {
    const { locale: _locale, ...collation } = makeCollation('kitchen', 'bare');
    const result = emitAndRun(emitCollation, collation);

    expectFallback(result, 'collation');
    expectSql(result, 'CREATE COLLATION "kitchen"."bare" (provider = icu);');
  });

  it('writes a locale with a backslash as an escape string constant', () => {
    const result = emitAndRun(
      emitCollation,
      makeCollation('kitchen', 'odd', { locale: String.raw`und-x-a\b` })
    );

    expect(result.steps[0]).toContain(String.raw`E'und-x-a\\b'`);
  });
});

describe('emitShellType', () => {
  function makeShellType(schema: string, name: string): ShellType {
    return { kind: 'shellType', oid: nextOid(), schema, name };
  }

  it('declares a shell type with CREATE TYPE and its name only, which no pgm operation writes', () => {
    const result = emitAndRun(
      emitShellType,
      makeShellType('kitchen', 'shell_t')
    );

    expectFallback(result, 'shell type');
    expect(result.calls).toStrictEqual(['sql']);
    expectSql(result, 'CREATE TYPE "kitchen"."shell_t";');
  });

  it('quotes the schema and name of a shell type', () => {
    const result = emitAndRun(
      emitShellType,
      makeShellType('user', 'Shell "T"')
    );

    expectFallback(result, 'shell type');
    expect(result.steps).toStrictEqual(['CREATE TYPE "user"."Shell ""T""";']);
  });
});

describe('emitRange', () => {
  it('writes the multirange name when it is in another schema', () => {
    const result = emitAndRun(
      emitRange,
      makeRange('kitchen', 'span_range', 'integer', {
        multirange: { schema: 'public', name: 'span_multirange' },
      })
    );

    expectFallback(result, 'range type');
    expectSql(
      result,
      'CREATE TYPE "kitchen"."span_range" AS RANGE (subtype = integer, multirange_type_name = public.span_multirange);'
    );
  });
});
