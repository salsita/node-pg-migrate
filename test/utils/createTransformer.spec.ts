import { describe, expect, it } from 'vitest';
import { PgLiteral } from '../../src';
import { createSchemalize, createTransformer } from '../../src/utils';

describe('utils', () => {
  describe('createTransformer', () => {
    it('should handle string and Name', () => {
      const t = createTransformer(createSchemalize(true, true));

      expect(
        t('CREATE INDEX {string} ON {name} (id);', {
          string: 'string',
          name: { schema: 'schema', name: 'name' },
        })
      ).toBe('CREATE INDEX "string" ON "schema"."name" (id);');
    });

    it('should not escape PgLiteral', () => {
      const t = createTransformer(createSchemalize(true, true));

      expect(
        t('INSERT INTO s (id) VALUES {values};', {
          values: new PgLiteral(['s1', 's2'].map((e) => `('${e}')`).join(', ')),
        })
      ).toBe("INSERT INTO s (id) VALUES ('s1'), ('s2');");
    });

    it('should use number', () => {
      const t = createTransformer(createSchemalize(true, true));

      expect(
        t('INSERT INTO s (id) VALUES ({values});', {
          values: 1,
        })
      ).toBe('INSERT INTO s (id) VALUES (1);');
    });
  });
});
