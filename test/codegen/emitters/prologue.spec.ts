import { describe, expect, it } from 'vitest';
import {
  emitEpilogue,
  emitPrologue,
} from '../../../src/codegen/emitters/prologue';
import { expectSql } from '../expectations';
import { execute } from '../run';

describe('emitPrologue', () => {
  it.each(['ts', 'js'] as const)(
    'saves check_function_bodies and turns it off with pgm.sql (%s)',
    (language) => {
      const step = emitPrologue();
      const result = execute(step, language);

      expect(step.kind).toBe('code');
      expect(result.calls).toStrictEqual(['sql', 'sql']);
      expectSql(
        result,
        `SELECT pg_catalog.set_config('node_pg_migrate.check_function_bodies', pg_catalog.current_setting('check_function_bodies'), true);
         SET LOCAL check_function_bodies = false;`
      );
    }
  );
});

describe('emitEpilogue', () => {
  it.each(['ts', 'js'] as const)(
    'restores check_function_bodies with pgm.sql (%s)',
    (language) => {
      const step = emitEpilogue();
      const result = execute(step, language);

      expect(step.kind).toBe('code');
      expect(result.calls).toStrictEqual(['sql']);
      expectSql(
        result,
        "SELECT pg_catalog.set_config('check_function_bodies', pg_catalog.current_setting('node_pg_migrate.check_function_bodies'), true);"
      );
    }
  );
});
