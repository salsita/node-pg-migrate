import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HeaderMeta } from '../../src/baseline/types';
import { renderMigration } from '../../src/codegen/render';
import type { Emitted, OutputLanguage } from '../../src/codegen/types';
import { loadMigration, runUp } from './run';

const FAKE_COMMAND =
  "node-pg-migrate up 1700000000000_baseline --fake -m 'db migrations'";

const HEADER: HeaderMeta = {
  migrationName: '1700000000000_baseline',
  fakeCommand: FAKE_COMMAND,
  source: { serverVersion: '18.6' },
  materializedViews: 0,
  relations: 12,
};

const STEPS: ReadonlyArray<Emitted> = [
  { kind: 'code', code: "pgm.sql('SELECT 1');" },
  {
    kind: 'code',
    code: "pgm.createTable('t', {\n  id: { type: 'integer' },\n  name: 'text',\n});",
  },
  {
    kind: 'fallback',
    code: "pgm.sql('CREATE TYPE r AS RANGE (subtype = float8)');",
    reason: 'range type',
  },
  { kind: 'code', code: "pgm.sql('SELECT 2');\npgm.sql('SELECT 3');" },
];

const LANGUAGES: ReadonlyArray<OutputLanguage> = ['ts', 'js'];

/**
 * What comes before the code: the header comment.
 */
function headerOf(content: string): string {
  const lines = content.split('\n');

  return lines
    .slice(
      0,
      lines.findIndex((line) => /^(?:import|export)\b/.test(line))
    )
    .join('\n');
}

describe('renderMigration', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(LANGUAGES)(
    'writes a %s migration that the runner loads, whose up runs every step in order and whose down is false',
    async (language) => {
      const content = renderMigration(STEPS, { language, header: HEADER });
      const actions = await loadMigration(content, language);

      expect(actions.up).toBeTypeOf('function');
      expect(actions.down).toBe(false);
      await expect(runUp(actions)).resolves.toStrictEqual([
        'SELECT 1;',
        'CREATE TABLE "t" ("id" integer, "name" text);',
        'CREATE TYPE r AS RANGE (subtype = float8);',
        'SELECT 2;',
        'SELECT 3;',
      ]);
    }
  );

  it('writes the TypeScript migration with the types of node-pg-migrate', () => {
    const content = renderMigration(STEPS, { language: 'ts', header: HEADER });

    expect(content).toContain(
      "import type { MigrationBuilder } from 'node-pg-migrate';"
    );
    expect(content).toContain(
      'export const up = (pgm: MigrationBuilder): void => {'
    );
    expect(content).toContain('export const down = false;');
  });

  it('writes the JavaScript migration as an ES module with JSDoc types', () => {
    const content = renderMigration(STEPS, { language: 'js', header: HEADER });

    expect(content).not.toMatch(/^\s*import\b/m);
    expect(content).not.toContain('require(');
    expect(content).toContain("import('node-pg-migrate').MigrationBuilder");
    expect(content).toMatch(/^export const up = /m);
    expect(content).toContain('export const down = false;');
  });

  it.each(LANGUAGES)(
    'starts the %s migration with a comment that says where it comes from and how to record it',
    (language) => {
      const header = headerOf(
        renderMigration(STEPS, { language, header: HEADER })
      );

      expect(header).toContain('node-pg-migrate baseline');
      expect(header).toMatch(/experimental/i);
      expect(header).toContain('18.6');
      expect(header).toContain(FAKE_COMMAND);
      expect(header).not.toContain('max_locks_per_transaction');
      expect(header).not.toMatch(/materialized view/i);
    }
  );

  it('notes the materialized views and the locks the migration needs', () => {
    const header = headerOf(
      renderMigration(STEPS, {
        language: 'ts',
        header: {
          ...HEADER,
          materializedViews: 2,
          relations: 20_000,
          requiredMaxLocksPerTransaction: 256,
        },
      })
    );

    expect(header).toMatch(/materialized view/i);
    expect(header).toContain('max_locks_per_transaction');
    expect(header).toContain('256');
  });

  it.each(LANGUAGES)(
    'writes a fallback comment right above each fallback in %s',
    (language) => {
      const lines = renderMigration(STEPS, { language, header: HEADER }).split(
        '\n'
      );
      const fallbackCode = lines.findIndex((line) =>
        line.includes('CREATE TYPE r AS RANGE')
      );

      expect(lines[fallbackCode - 1].trim()).toBe('// fallback: range type');
      expect(
        lines.filter((line) => line.trim().startsWith('// fallback:'))
      ).toHaveLength(1);
    }
  );

  it.each(LANGUAGES)('indents every step by two spaces in %s', (language) => {
    const lines = renderMigration(STEPS, { language, header: HEADER }).split(
      '\n'
    );
    const expected = STEPS.flatMap((step) =>
      step.code.split('\n').map((line) => `  ${line}`)
    );
    const start = lines.indexOf(expected[0]);

    expect(start).toBeGreaterThan(-1);
    expect(
      lines
        .slice(start)
        .filter(
          (line) =>
            line.trim() !== '' && !line.trim().startsWith('// fallback:')
        )
        .slice(0, expected.length)
    ).toStrictEqual(expected);
  });

  it.each(LANGUAGES)(
    'writes the same %s file whenever it runs, ending with one newline',
    (language) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2020-01-01T00:00:00Z'));
      const first = renderMigration(STEPS, { language, header: HEADER });
      vi.setSystemTime(new Date('2031-06-15T12:34:56Z'));
      const second = renderMigration(STEPS, { language, header: HEADER });

      expect(second).toBe(first);
      expect(first.endsWith('\n')).toBe(true);
      expect(first.endsWith('\n\n')).toBe(false);
    }
  );
});
