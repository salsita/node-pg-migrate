import { describe, expect, it } from 'vitest';
import { PgLiteral } from '../../src';
import { createSchemalize, createTransformer } from '../../src/utils';

describe('utils', () => {
  describe('createTransformer', () => {
    it('should handle string and Name', () => {
      const t = createTransformer(
        createSchemalize({
          shouldDecamelize: true,
          shouldQuote: true,
        })
      );

      const actual = t('CREATE INDEX {string} ON {name} (id);', {
        string: 'string',
        name: { schema: 'schema', name: 'name' },
      });

      expect(actual).toBe('CREATE INDEX "string" ON "schema"."name" (id);');
    });

    it('should not escape PgLiteral', () => {
      const t = createTransformer(
        createSchemalize({
          shouldDecamelize: true,
          shouldQuote: true,
        })
      );

      const actual = t('INSERT INTO s (id) VALUES {values};', {
        values: new PgLiteral(['s1', 's2'].map((e) => `('${e}')`).join(', ')),
      });

      expect(actual).toBe("INSERT INTO s (id) VALUES ('s1'), ('s2');");
    });

    it('should use number', () => {
      const t = createTransformer(
        createSchemalize({
          shouldDecamelize: true,
          shouldQuote: true,
        })
      );

      const actual = t('INSERT INTO s (id) VALUES ({values});', {
        values: 1,
      });

      expect(actual).toBe('INSERT INTO s (id) VALUES (1);');
    });

    it('should fallback to empty mapping', () => {
      const t = createTransformer(
        createSchemalize({
          shouldDecamelize: true,
          shouldQuote: true,
        })
      );

      const actual = t('INSERT INTO s (id) VALUES ({values});');

      expect(actual).toBe('INSERT INTO s (id) VALUES ({values});');
    });

    it('should fallback to empty string for undefined value', () => {
      const t = createTransformer(
        createSchemalize({
          shouldDecamelize: true,
          shouldQuote: true,
        })
      );

      const actual = t('INSERT INTO s (id) VALUES ({values});', {
        // @ts-expect-error: JS-only test
        values: undefined,
      });

      // TODO @Shinigami92 2024-04-03: Should this be an error?
      expect(actual).toBe('INSERT INTO s (id) VALUES ();');
    });

    it('should correctly handle $ character in values', () => {
      const t = createTransformer(
        createSchemalize({
          shouldDecamelize: true,
          shouldQuote: true,
        })
      );
      const actual = t(
        'ALTER DOMAIN "quote_unit_type" ADD CONSTRAINT "quote_unit_type_values" CHECK (VALUE = ANY({values}))',
        {
          values: ['cents/lb', '$/tonne'],
        }
      );
      expect(actual).toBe(
        'ALTER DOMAIN "quote_unit_type" ADD CONSTRAINT "quote_unit_type_values" CHECK (VALUE = ANY(ARRAY[$pga$cents/lb$pga$,$pga$$/tonne$pga$]))'
      );
    });
  });
});
