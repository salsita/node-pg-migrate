import { describe, expect, it } from 'vitest';
import { emitCollation } from '../../../src/codegen/emitters/collations';
import type { Collation } from '../../../src/introspect/types';
import { makeCollation } from '../../introspect/objects';
import { expectFallback, expectSql } from '../expectations';
import { emitAndRun } from '../run';

type CollationFields = Partial<Omit<Collation, 'kind'>>;

describe('emitCollation', () => {
  it.each<[string, CollationFields, string]>([
    [
      'a libc collation with one locale',
      { provider: 'libc', lcCollate: 'C', lcCtype: 'C' },
      `CREATE COLLATION "kitchen"."c1" (provider = libc, locale = 'C');`,
    ],
    [
      'a libc collation whose LC_COLLATE and LC_CTYPE differ',
      { provider: 'libc', lcCollate: 'de_DE.utf8', lcCtype: 'C' },
      `CREATE COLLATION "kitchen"."c1" (provider = libc, lc_collate = 'de_DE.utf8', lc_ctype = 'C');`,
    ],
    [
      'a nondeterministic ICU collation with rules',
      {
        provider: 'icu',
        locale: 'und-u-ks-level2',
        deterministic: false,
        rules: '&a < b',
      },
      `CREATE COLLATION "kitchen"."c1" (provider = icu, locale = 'und-u-ks-level2', deterministic = false, rules = '&a < b');`,
    ],
    [
      'a builtin collation',
      { provider: 'builtin', locale: 'C.UTF-8' },
      `CREATE COLLATION "kitchen"."c1" (provider = builtin, locale = 'C.UTF-8');`,
    ],
  ])('creates %s with CREATE COLLATION', (_, fields, expected) => {
    const base = makeCollation('kitchen', 'c1');
    const { locale: _locale, ...withoutLocale } = base;
    const result = emitAndRun(emitCollation, { ...withoutLocale, ...fields });

    expectFallback(result, 'collation');
    expect(result.calls).toStrictEqual(['sql']);
    expectSql(result, expected);
  });
});
