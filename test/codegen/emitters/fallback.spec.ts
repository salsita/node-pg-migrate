import { describe, expect, it } from 'vitest';
import { emitFallback } from '../../../src/codegen/emitters/fallback';
import { execute } from '../run';

const TRICKY_SQL = [
  `CREATE TABLE "t" ("a" text DEFAULT 'it''s {a} \${b} \\n');`,
  'COMMENT ON TABLE "t" IS E\'line\\nbreak $$ \u2028 `tick`\';',
].join('\n');

describe('emitFallback', () => {
  describe.each(['ts', 'js'] as const)('in %s', (language) => {
    it.each([
      ['a statement', 'CREATE RULE r AS ON DELETE TO t DO INSTEAD NOTHING;'],
      ['statements with quotes, escapes and placeholders', TRICKY_SQL],
    ])('runs %s as it is, with pgm.sql', (_, sql) => {
      const step = emitFallback(sql, 'range type');
      const result = execute(step, language);

      expect(step).toMatchObject({ kind: 'fallback', reason: 'range type' });
      expect(result.calls).toStrictEqual(['sql']);
      expect(result.steps).toStrictEqual([sql]);
    });

    it('lets pgm.sql end a statement without ;', () => {
      const result = execute(
        emitFallback('SELECT 1', 'extended statistics'),
        language
      );

      expect(result.steps).toStrictEqual(['SELECT 1;']);
    });
  });
});
