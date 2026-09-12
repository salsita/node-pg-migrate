import { describe, expect, it, vi } from 'vitest';
import type { CatalogBaselineOptions } from '../../src/baseline/catalogs';
import {
  BaselineError,
  generateBaselineFromCatalogs,
} from '../../src/baseline/catalogs';
import { rejectionOf } from './helpers';

// `generateBaselineFromCatalogs()` refuses the options that `baseline()`
// refuses before it touches the database. What it generates, and what it
// refuses about a database, is in test/integration/baseline/catalogs.spec.ts.

describe('generateBaselineFromCatalogs', () => {
  it.each<{ options: CatalogBaselineOptions; message: string }>([
    {
      options: { migrationName: '1700000000000_baseline', migrationsTable: '' },
      message: 'migrationsTable must not be empty.',
    },
    {
      options: {
        migrationName: '1700000000000_baseline',
        format: 'sql' as CatalogBaselineOptions['format'],
      },
      message: 'format must be ts or js, not sql.',
    },
  ])(
    'rejects $options with INVALID_OPTIONS before it sends any query',
    async ({ options, message }) => {
      const query = vi.fn(() => Promise.resolve({ rows: [] }));

      const error = await rejectionOf(
        generateBaselineFromCatalogs({ query }, options)
      );

      expect(error).toBeInstanceOf(BaselineError);
      expect(error).toMatchObject({ code: 'INVALID_OPTIONS', message });
      expect(query).not.toHaveBeenCalled();
    }
  );
});
