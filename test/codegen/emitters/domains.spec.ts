import { describe, expect, it } from 'vitest';
import { emitDomain } from '../../../src/codegen/emitters/domains';
import { makeDomain } from '../../introspect/objects';
import {
  expectCode,
  expectFallback,
  expectSql,
  expectSqlOneOf,
} from '../expectations';
import { emitAndRun } from '../run';

describe('emitDomain', () => {
  it('creates a domain with a default and a CHECK with pgm.createDomain', () => {
    const result = emitAndRun(
      emitDomain,
      makeDomain('kitchen', 'money_amount', 'numeric(12,2)', {
        default: '0',
        checks: [
          {
            name: 'money_not_negative',
            expression: '(VALUE >= (0)::numeric)',
            validated: true,
            comment: 'Set by a comment step',
          },
        ],
        comment: 'Set by a comment step',
      })
    );

    expectCode(result);
    expect(result.calls).toStrictEqual(['createDomain']);
    expect(result.funcs).toStrictEqual(['0']);
    expectSql(
      result,
      'CREATE DOMAIN "kitchen"."money_amount" AS numeric(12,2) DEFAULT 0 CONSTRAINT "money_not_negative" CHECK ((VALUE >= (0)::numeric));'
    );
  });

  it('creates a NOT NULL domain with a collation', () => {
    const result = emitAndRun(
      emitDomain,
      makeDomain('public', 'email_address', 'text', {
        notNull: true,
        collation: 'pg_catalog."C"',
        default: "'nobody@example.com'::text",
      })
    );

    expectCode(result);
    expect(result.funcs).toStrictEqual(["'nobody@example.com'::text"]);
    expectSql(
      result,
      `CREATE DOMAIN "email_address" AS text COLLATE pg_catalog."C" DEFAULT 'nobody@example.com'::text NOT NULL;`
    );
  });

  it('adds the CHECKs that pgm.createDomain cannot take with ALTER DOMAIN', () => {
    const result = emitAndRun(
      emitDomain,
      makeDomain('kitchen', 'percentage', 'integer', {
        checks: [
          {
            name: 'percentage_max',
            expression: '(VALUE <= 100)',
            validated: true,
          },
          {
            name: 'percentage_min',
            expression: '(VALUE >= 0)',
            validated: true,
          },
        ],
      })
    );

    expectFallback(result, 'several constraints');
    expect(result.calls).toStrictEqual(['createDomain', 'sql']);
    expectSql(
      result,
      `CREATE DOMAIN "kitchen"."percentage" AS integer CONSTRAINT "percentage_max" CHECK ((VALUE <= 100));
       ALTER DOMAIN "kitchen"."percentage" ADD CONSTRAINT "percentage_min" CHECK ((VALUE >= 0));`
    );
  });

  it('adds what pgm.createDomain cannot take when a domain is NOT NULL and has a CHECK', () => {
    const result = emitAndRun(
      emitDomain,
      makeDomain('kitchen', 'positive', 'integer', {
        notNull: true,
        checks: [
          {
            name: 'positive_check',
            expression: '(VALUE > 0)',
            validated: true,
          },
        ],
      })
    );

    expectFallback(result, 'several constraints');
    expect(result.calls[0]).toBe('createDomain');
    expectSqlOneOf(result, [
      `CREATE DOMAIN "kitchen"."positive" AS integer NOT NULL;
       ALTER DOMAIN "kitchen"."positive" ADD CONSTRAINT "positive_check" CHECK ((VALUE > 0));`,
      `CREATE DOMAIN "kitchen"."positive" AS integer CONSTRAINT "positive_check" CHECK ((VALUE > 0));
       ALTER DOMAIN "kitchen"."positive" SET NOT NULL;`,
    ]);
  });
});
