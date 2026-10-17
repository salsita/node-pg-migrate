import { describe, expect, it } from 'vitest';
import { emitExtension } from '../../../src/codegen/emitters/extensions';
import { makeExtension } from '../../introspect/objects';
import { expectCode, expectSql, expectSqlOneOf } from '../expectations';
import { emitAndRun } from '../run';

describe('emitExtension', () => {
  it('creates an extension in its schema with pgm.createExtension, if it does not exist', () => {
    const result = emitAndRun(
      emitExtension,
      makeExtension('kitchen', 'pg_trgm', { version: '1.6' })
    );

    expectCode(result);
    expect(result.calls).toStrictEqual(['createExtension']);
    expectSql(
      result,
      'CREATE EXTENSION IF NOT EXISTS "pg_trgm" SCHEMA "kitchen";'
    );
  });

  it('creates an extension of the default schema', () => {
    const result = emitAndRun(
      emitExtension,
      makeExtension('public', 'uuid-ossp')
    );

    expectCode(result);
    expectSqlOneOf(result, [
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA "public";',
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
    ]);
  });
});
