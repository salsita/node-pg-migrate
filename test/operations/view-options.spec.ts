import { describe, expect, it } from 'vitest';
import {
  alterMaterializedView,
  createMaterializedView,
} from '../../src/operations/materializedViews';
import { alterView, createView } from '../../src/operations/views';
import { options1, options2 } from '../presetMigrationOptions';

describe('view option escaping', () => {
  it.each([createView, alterView])(
    'escapes names and string values in %s',
    (operation) => {
      const sql = operation(options1)(
        'v',
        {
          options: { 'custom"Option': "a'b$pga$); DROP VIEW v; --" },
        },
        'SELECT 1'
      );
      expect(sql).toContain(
        '("custom""option" = $pgb$a\'b$pga$); DROP VIEW v; --$pgb$)'
      );
    }
  );

  it.each([createView, alterView])(
    'escapes namespaced string options in %s',
    (operation) => {
      expect(
        operation(options1)(
          'v',
          {
            options: {
              'timescaledb.continuous': true,
              'timescaledb.refresh_lag': '-30m',
            },
          },
          'SELECT 1'
        )
      ).toContain(
        '("timescaledb"."continuous" = true, "timescaledb"."refresh_lag" = $pga$-30m$pga$)'
      );
    }
  );

  it.each([options1, options2])(
    'preserves option case folding without decamelization',
    (options) => {
      expect(
        createView(options)(
          { schema: 'MySchema', name: 'MyView' },
          {
            options: {
              CHECK_OPTION: 'LOCAL',
              security_barrier: true,
              customOption: 0,
              another_option: false,
            },
          },
          'SELECT 1'
        )
      ).toContain(
        'WITH ("check_option" = $pga$LOCAL$pga$, "security_barrier" = true, "customoption" = 0, "another_option" = false)'
      );
    }
  );

  it.each([createMaterializedView, alterMaterializedView])(
    'preserves namespaced numeric and boolean parameters in %s',
    (operation) => {
      expect(
        operation(options2)(
          'v',
          {
            storageParameters: {
              FillFactor: 70,
              'TOAST.Autovacuum_enabled': false,
              autovacuum_enabled: true,
              autovacuum_vacuum_scale_factor: 0,
              'custom"Option': 0.5,
            },
          },
          'SELECT 1'
        )
      ).toContain(
        '("fillfactor" = 70, "toast"."autovacuum_enabled" = false, "autovacuum_enabled" = true, "autovacuum_vacuum_scale_factor" = 0, "custom""option" = 0.5)'
      );
    }
  );

  it('quotes RESET names and keeps null out of SET', () => {
    expect(
      alterView(options1)('v', {
        options: { 'custom"Option': null, SECURITY_BARRIER: false },
      })
    ).toBe(
      'ALTER VIEW "v" SET ("security_barrier" = false);\nALTER VIEW "v" RESET ("custom""option");'
    );
    expect(
      alterMaterializedView(options1)('v', {
        storageParameters: {
          'TOAST.Autovacuum_enabled': null,
          'custom"Option': null,
          FillFactor: 70,
        },
      })
    ).toBe(
      'ALTER MATERIALIZED VIEW "v" SET ("fillfactor" = 70), RESET ("toast"."autovacuum_enabled", "custom""option");'
    );
  });

  it.each([createView, createMaterializedView])(
    'omits WITH for empty maps in %s',
    (operation) => {
      expect(
        operation(options1)(
          'v',
          { options: {}, storageParameters: {} },
          'SELECT 1'
        )
      ).not.toContain('WITH');
    }
  );
});
