import { describe, expect, it } from 'vitest';
import { scanTopLevel } from '../../../src/baseline/core/scan';
import type { SegmentKind, TopLevelSegment } from '../../../src/baseline/types';
import {
  ADVERSARIAL_FILES,
  CAPTURED_DUMPS,
  countOf,
  readAdversarial,
} from '../helpers';

/**
 * Where each segment has to start, given the texts of the segments before
 * it: the offset right after them and the line that offset is on.
 */
function expectedPositions(
  segments: ReadonlyArray<TopLevelSegment>
): Array<{ start: number; line: number }> {
  let start = 0;
  let line = 1;

  return segments.map((segment) => {
    const position = { start, line };
    start += segment.text.length;
    line += countOf(segment.text, '\n');

    return position;
  });
}

/**
 * The `start` and `line` of every segment.
 */
function positionsOf(
  segments: ReadonlyArray<TopLevelSegment>
): Array<{ start: number; line: number }> {
  return segments.map(({ start, line }) => ({ start, line }));
}

/**
 * The segments that are not whitespace or comments, as `[kind, text]`.
 */
function significant(sql: string): Array<[SegmentKind, string]> {
  return scanTopLevel(sql)
    .filter((segment) => segment.kind !== 'trivia')
    .map((segment) => [segment.kind, segment.text]);
}

/**
 * The texts of the `statement` segments.
 */
function statementsOf(sql: string): string[] {
  return scanTopLevel(sql)
    .filter((segment) => segment.kind === 'statement')
    .map((segment) => segment.text);
}

/**
 * The 1-based line of an offset.
 */
function lineAt(sql: string, offset: number): number {
  return countOf(sql.slice(0, offset), '\n') + 1;
}

/**
 * Inputs that are easy to get wrong at the edges: empty, unterminated
 * quotes and comments, lone `$` and `\`, CRLF, non-BMP characters…
 */
const EDGE_INPUTS: ReadonlyArray<string> = [
  '',
  ' ',
  '\n',
  ';',
  ';;\n;',
  'SELECT 1',
  'SELECT 1;',
  'SELECT 1;\n',
  '\\',
  '\\\n',
  '\\connect app',
  "SELECT 'unterminated",
  'SELECT "unterminated',
  'SELECT $$unterminated',
  'SELECT $a$ unterminated $b$',
  "SELECT E'unterminated\\'",
  '/* unterminated',
  '/* /* nested */ unterminated',
  '-- no newline',
  '$',
  '$$',
  '$1',
  '$a',
  "E'",
  'COPY t FROM stdin;',
  'COPY t FROM stdin;\n',
  'COPY t FROM stdin;\n1\n\\.',
  'COPY t FROM stdin;\nno end marker\n',
  'CREATE FUNCTION f() RETURNS integer LANGUAGE sql BEGIN ATOMIC SELECT 1;',
  'END; BEGIN; CASE;',
  'SELECT 1;\r\nSELECT 2;\r\n',
  '\uFEFFSELECT 1;',
  "SELECT '😀;'; -- 😀\n",
];

describe('scanTopLevel', () => {
  describe('exact slices', () => {
    it.each(CAPTURED_DUMPS)(
      'slices the captured dump $name exactly',
      ({ sql }) => {
        const segments = scanTopLevel(sql);

        expect(segments.map((segment) => segment.text).join('')).toBe(sql);
        expect(positionsOf(segments)).toEqual(expectedPositions(segments));
        expect(segments.filter((segment) => segment.text === '')).toEqual([]);
      }
    );

    it.each(ADVERSARIAL_FILES)('slices the adversarial %s exactly', (file) => {
      const sql = readAdversarial(file);
      const segments = scanTopLevel(sql);

      expect(segments.map((segment) => segment.text).join('')).toBe(sql);
      expect(positionsOf(segments)).toEqual(expectedPositions(segments));
      expect(segments.filter((segment) => segment.text === '')).toEqual([]);
    });

    it.each(EDGE_INPUTS)('slices %j exactly', (sql) => {
      const segments = scanTopLevel(sql);

      expect(segments.map((segment) => segment.text).join('')).toBe(sql);
      expect(positionsOf(segments)).toEqual(expectedPositions(segments));
      expect(segments.filter((segment) => segment.text === '')).toEqual([]);
    });

    it.each(CAPTURED_DUMPS)(
      'starts every statement of $name at a top-level keyword and ends it with ";"',
      ({ sql }) => {
        const statements = scanTopLevel(sql).filter(
          (segment) => segment.kind === 'statement'
        );

        expect(statements.length).toBeGreaterThan(0);
        expect(
          statements.filter(
            (segment) =>
              !/^(?:ALTER|COMMENT|CREATE|SELECT|SET) /.test(segment.text) ||
              !segment.text.endsWith(';')
          )
        ).toEqual([]);
      }
    );

    it.each(CAPTURED_DUMPS)(
      'only has whitespace and comments between the statements of $name',
      ({ sql }) => {
        const trivia = scanTopLevel(sql).filter(
          (segment) => segment.kind === 'trivia'
        );

        expect(
          trivia.filter(
            (segment) => !/^(?:\s|--[^\n]*(?:\n|$))*$/.test(segment.text)
          )
        ).toEqual([]);
      }
    );
  });

  describe('statements', () => {
    it('ends a statement at a top-level semicolon, which it includes', () => {
      expect(significant('SELECT 1;SELECT 2; SELECT 3;\n')).toEqual([
        ['statement', 'SELECT 1;'],
        ['statement', 'SELECT 2;'],
        ['statement', 'SELECT 3;'],
      ]);
    });

    it('leaves the whitespace and comments around statements out of them', () => {
      const sql = '  -- lead\n/* block */\nSELECT 1; -- trailing\n\n';
      const segments = scanTopLevel(sql);

      expect(significant(sql)).toEqual([['statement', 'SELECT 1;']]);
      expect(
        segments
          .filter((segment) => segment.kind === 'trivia')
          .map((segment) => segment.text)
          .join('')
      ).toBe('  -- lead\n/* block */\n -- trailing\n\n');
    });

    it('makes the text after the last semicolon an unterminated statement up to the end', () => {
      expect(scanTopLevel('SELECT 1;\nSELECT 2\n').at(-1)).toEqual({
        kind: 'statement',
        text: 'SELECT 2\n',
        start: 10,
        line: 2,
      });
    });

    it.each([
      {
        name: 'string',
        sql: "SELECT 'a;\nb; SELECT 2;",
      },
      {
        name: 'dollar quote',
        sql: 'SELECT $$a; SELECT 2;',
      },
      {
        name: 'block comment',
        sql: 'SELECT 1 /* ; SELECT 2;',
      },
    ])(
      'runs a statement with an unterminated $name to the end of the input',
      ({ sql }) => {
        expect(significant(sql)).toEqual([['statement', sql]]);
      }
    );
  });

  describe('quotes and comments inside statements', () => {
    it.each([
      {
        name: "a semicolon inside '…'",
        sql: "SELECT 'a;b'; SELECT 2;",
        statements: ["SELECT 'a;b';", 'SELECT 2;'],
      },
      {
        name: "doubled quotes inside '…'",
        sql: "SELECT 'it''s; fine'; SELECT 2;",
        statements: ["SELECT 'it''s; fine';", 'SELECT 2;'],
      },
      {
        name: "a backslash inside '…', which escapes nothing",
        sql: "SELECT 'C:\\'; SELECT 2;",
        statements: ["SELECT 'C:\\';", 'SELECT 2;'],
      },
      {
        name: "an escaped quote inside E'…'",
        sql: "SELECT E'it\\'s; fine'; SELECT 2;",
        statements: ["SELECT E'it\\'s; fine';", 'SELECT 2;'],
      },
      {
        name: "an escaped quote inside e'…'",
        sql: "SELECT e'\\'; still inside'; SELECT 2;",
        statements: ["SELECT e'\\'; still inside';", 'SELECT 2;'],
      },
      {
        name: "an escaped backslash right before the end of E'…'",
        sql: "SELECT E'a\\\\'; SELECT 2;",
        statements: ["SELECT E'a\\\\';", 'SELECT 2;'],
      },
      {
        name: "doubled quotes inside E'…'",
        sql: "SELECT E'x''; y'; SELECT 2;",
        statements: ["SELECT E'x''; y';", 'SELECT 2;'],
      },
      {
        name: 'a semicolon inside "…"',
        sql: 'SELECT 1 AS "a;b"; SELECT 2;',
        statements: ['SELECT 1 AS "a;b";', 'SELECT 2;'],
      },
      {
        name: 'doubled quotes inside "…"',
        sql: 'SELECT 1 AS "a"";b"; SELECT 2;',
        statements: ['SELECT 1 AS "a"";b";', 'SELECT 2;'],
      },
      {
        name: 'a single quote inside "…"',
        sql: `SELECT 1 AS "it's; ok"; SELECT 2;`,
        statements: [`SELECT 1 AS "it's; ok";`, 'SELECT 2;'],
      },
      {
        name: "a double quote inside '…'",
        sql: `SELECT '"; x'; SELECT 2;`,
        statements: [`SELECT '"; x';`, 'SELECT 2;'],
      },
      {
        name: 'a semicolon inside $$…$$',
        sql: 'SELECT $$a;b$$; SELECT 2;',
        statements: ['SELECT $$a;b$$;', 'SELECT 2;'],
      },
      {
        name: 'quotes and comment markers inside $$…$$',
        sql: `SELECT $$it's "quoted"; -- /*$$; SELECT 2;`,
        statements: [`SELECT $$it's "quoted"; -- /*$$;`, 'SELECT 2;'],
      },
      {
        name: '$$ inside $tag$…$tag$',
        sql: 'SELECT $body$a;$$;b$body$; SELECT 2;',
        statements: ['SELECT $body$a;$$;b$body$;', 'SELECT 2;'],
      },
      {
        name: 'nested dollar quotes with different tags',
        sql: 'SELECT $outer$ $inner$ ; $inner$ ; $outer$; SELECT 2;',
        statements: [
          'SELECT $outer$ $inner$ ; $inner$ ; $outer$;',
          'SELECT 2;',
        ],
      },
      {
        name: 'a dollar-quote tag with underscores and digits',
        sql: 'SELECT $_x1$ ; $_x1$; SELECT 2;',
        statements: ['SELECT $_x1$ ; $_x1$;', 'SELECT 2;'],
      },
      {
        name: 'a dollar-quote tag in another case, which does not end the quote',
        sql: 'SELECT $Tag$ ; $tag$ ; $Tag$; SELECT 2;',
        statements: ['SELECT $Tag$ ; $tag$ ; $Tag$;', 'SELECT 2;'],
      },
      {
        name: 'parameters, which are not dollar quotes',
        sql: 'SELECT $1; SELECT $2, $3; SELECT 4;',
        statements: ['SELECT $1;', 'SELECT $2, $3;', 'SELECT 4;'],
      },
      {
        name: 'a parameter next to a dollar quote',
        sql: 'SELECT $1, $$;$$; SELECT 2;',
        statements: ['SELECT $1, $$;$$;', 'SELECT 2;'],
      },
      {
        name: 'a semicolon inside a -- comment',
        sql: 'SELECT 1 -- ;\n; SELECT 2;',
        statements: ['SELECT 1 -- ;\n;', 'SELECT 2;'],
      },
      {
        name: 'a quote inside a -- comment',
        sql: "SELECT 1 -- it's\n; SELECT 2;",
        statements: ["SELECT 1 -- it's\n;", 'SELECT 2;'],
      },
      {
        name: 'quotes inside a /* */ comment',
        sql: `SELECT 1 /* it's $$ " */; SELECT 2;`,
        statements: [`SELECT 1 /* it's $$ " */;`, 'SELECT 2;'],
      },
      {
        name: 'a semicolon inside nested /* */ comments',
        sql: 'SELECT /* a /* b */ ; */ 1; SELECT 2;',
        statements: ['SELECT /* a /* b */ ; */ 1;', 'SELECT 2;'],
      },
      {
        name: 'comment markers inside strings',
        sql: "SELECT '--'; SELECT '/*'; SELECT 3;",
        statements: ["SELECT '--';", "SELECT '/*';", 'SELECT 3;'],
      },
      {
        name: 'comment markers and $$ inside quoted identifiers',
        sql: 'SELECT 1 AS "--", 2 AS "/*", 3 AS "$$"; SELECT 4;',
        statements: ['SELECT 1 AS "--", 2 AS "/*", 3 AS "$$";', 'SELECT 4;'],
      },
      {
        name: 'operators that are not comments',
        sql: 'SELECT 4 / 2 - 1 * 3; SELECT 2;',
        statements: ['SELECT 4 / 2 - 1 * 3;', 'SELECT 2;'],
      },
    ])('keeps $name in its statement', ({ sql, statements }) => {
      expect(significant(sql)).toEqual(
        statements.map((statement) => ['statement', statement])
      );
    });
  });

  describe('comments between statements', () => {
    it('keeps a semicolon inside nested /* */ comments out of the statements', () => {
      expect(significant('/* a /* b ; */ c ; */\nSELECT 1;\n')).toEqual([
        ['statement', 'SELECT 1;'],
      ]);
    });

    it('keeps a semicolon inside a -- comment out of the statements', () => {
      expect(significant('-- a; b\nSELECT 1;\n')).toEqual([
        ['statement', 'SELECT 1;'],
      ]);
    });
  });

  describe('psql meta-commands', () => {
    it('makes a line starting with a backslash between statements a meta segment, with its newline', () => {
      expect(significant('\\connect app\nSELECT 1;\n')).toEqual([
        ['meta', '\\connect app\n'],
        ['statement', 'SELECT 1;'],
      ]);
    });

    it('ends a meta segment at the end of the input', () => {
      expect(significant('SELECT 1;\n\\unrestrict key')).toEqual([
        ['statement', 'SELECT 1;'],
        ['meta', '\\unrestrict key'],
      ]);
    });

    it('makes each meta-command line its own segment', () => {
      expect(
        significant('\\unrestrict k\n\\connect app\n\\restrict k\n')
      ).toEqual([
        ['meta', '\\unrestrict k\n'],
        ['meta', '\\connect app\n'],
        ['meta', '\\restrict k\n'],
      ]);
    });

    it('finds the meta-commands of psql-connect.sql on their lines', () => {
      const sql = readAdversarial('psql-connect.sql');
      const lines = sql.split('\n');

      expect(
        scanTopLevel(sql)
          .filter((segment) => segment.kind === 'meta')
          .map(({ line, text }) => ({ line, text }))
      ).toEqual(
        [5, 22, 23, 24, 78].map((line) => ({
          line,
          text: `${lines[line - 1]}\n`,
        }))
      );
    });

    it('keeps a backslash line inside a string literal in its statement', () => {
      expect(significant("SELECT 'a\n\\connect b\n';\n")).toEqual([
        ['statement', "SELECT 'a\n\\connect b\n';"],
      ]);
    });

    it('keeps a backslash line inside a dollar-quoted body in its statement', () => {
      const sql =
        'CREATE FUNCTION f() RETURNS text\n    LANGUAGE sql\n    AS $$\nSELECT 1\n\\.\n$$;\n';

      expect(significant(sql)).toEqual([['statement', sql.trimEnd()]]);
    });

    it('keeps the backslash lines of backslash-line-in-function-body.sql in the function', () => {
      const sql = readAdversarial('backslash-line-in-function-body.sql');
      const lines = sql.split('\n');
      const segments = scanTopLevel(sql);

      expect(
        segments
          .filter((segment) => segment.kind === 'meta')
          .map((segment) => segment.line)
      ).toEqual([5, 42]);
      expect(
        segments.find(
          (segment) => segment.kind === 'statement' && segment.line === 26
        )?.text
      ).toBe(lines.slice(25, 35).join('\n'));
    });

    it.each(CAPTURED_DUMPS.filter((dump) => dump.fixture === 'kitchen-sink'))(
      'keeps the backslash line of a string literal of $name in its statement',
      ({ sql }) => {
        const segments = scanTopLevel(sql);

        expect(
          segments
            .filter((segment) => segment.kind === 'meta')
            .map((segment) => segment.text)
        ).toEqual([
          expect.stringMatching(/^\\restrict \w+\n$/),
          expect.stringMatching(/^\\unrestrict \w+\n$/),
        ]);
        expect(
          segments.filter(
            (segment) =>
              segment.kind === 'statement' &&
              segment.text.startsWith(
                'COMMENT ON TABLE "Sink Área"."Order; Lines" IS'
              )
          )
        ).toEqual([
          expect.objectContaining({
            text: expect.stringContaining(
              '\n\\connect is only text here, inside a string literal\n'
            ),
          }),
        ]);
      }
    );
  });

  describe('COPY data', () => {
    it('makes the data of copy-data.sql one copy-data segment, up to and including the \\. line', () => {
      const sql = readAdversarial('copy-data.sql');
      const segments = scanTopLevel(sql).filter(
        (segment) => segment.kind !== 'trivia'
      );
      const copy = segments.findIndex(
        (segment) => segment.text === 'COPY public.notes (id, body) FROM stdin;'
      );

      expect(segments[copy]).toMatchObject({ kind: 'statement', line: 54 });
      expect(segments[copy + 1]?.kind).toBe('copy-data');
      expect(segments[copy + 1]?.text).toMatch(
        /1\tfirst note\n2\tsecond; note with a tab\\tand a backslash \\\\\n\\\.\n$/
      );
      expect(segments[copy + 2]).toMatchObject({
        kind: 'statement',
        text: "SELECT pg_catalog.setval('public.notes_id_seq', 2, true);",
        line: 64,
      });
      expect(
        segments.filter(
          (segment) =>
            segment.kind === 'statement' && segment.text.includes('first note')
        )
      ).toEqual([]);
    });

    it.each([
      {
        name: 'semicolons and tabs in the data',
        sql: 'COPY public.t (a, b) FROM stdin;\n1\tx;y\n\\.\nSELECT 1;\n',
        data: '1\tx;y\n\\.\n',
        next: 'SELECT 1;',
      },
      {
        name: 'lower-case keywords, options and quotes in the data',
        sql: "copy t (a) from STDIN with (format csv);\na;'b\n\\.\nSELECT 1;\n",
        data: "a;'b\n\\.\n",
        next: 'SELECT 1;',
      },
      {
        name: 'data lines starting with a backslash',
        sql: 'COPY t FROM stdin;\n\\N\t1\n\\.\nSELECT 1;\n',
        data: '\\N\t1\n\\.\n',
        next: 'SELECT 1;',
      },
    ])('ends COPY data with $name at the \\. line', ({ sql, data, next }) => {
      const segments = significant(sql);

      expect(segments.map(([kind]) => kind)).toEqual([
        'statement',
        'copy-data',
        'statement',
      ]);
      expect(segments[1]?.[1].endsWith(data)).toBe(true);
      expect(segments[2]?.[1]).toBe(next);
    });

    it('runs COPY data without a \\. line to the end of the input', () => {
      const sql = 'COPY t FROM stdin;\n1\n2\n';
      const segments = scanTopLevel(sql);

      expect(segments.at(-1)?.kind).toBe('copy-data');
      expect(segments.at(-1)?.text.endsWith('1\n2\n')).toBe(true);
      expect(statementsOf(sql)).toEqual(['COPY t FROM stdin;']);
    });

    it('ends COPY data at a \\. line at the end of the input', () => {
      const segments = scanTopLevel('COPY t FROM stdin;\n1\n\\.');

      expect(segments.at(-1)?.kind).toBe('copy-data');
      expect(segments.at(-1)?.text.endsWith('1\n\\.')).toBe(true);
    });

    it.each([
      {
        name: 'COPY … TO stdout',
        sql: 'COPY t TO stdout;\nSELECT 1;\n',
        statements: ['COPY t TO stdout;', 'SELECT 1;'],
      },
      {
        name: 'a string that mentions COPY … FROM stdin',
        sql: "SELECT 'COPY t FROM stdin';\nSELECT 1;\n",
        statements: ["SELECT 'COPY t FROM stdin';", 'SELECT 1;'],
      },
    ])('does not read data after $name', ({ sql, statements }) => {
      expect(significant(sql)).toEqual(
        statements.map((statement) => ['statement', statement])
      );
    });
  });

  describe('BEGIN ATOMIC bodies', () => {
    it.each(CAPTURED_DUMPS.filter((dump) => dump.fixture === 'kitchen-sink'))(
      'keeps the BEGIN ATOMIC function of $name in one statement',
      ({ sql }) => {
        const start = sql.indexOf('CREATE FUNCTION kitchen.order_count(');
        const end = sql.indexOf('\nEND;', start) + '\nEND;'.length;

        expect(sql.slice(start, end)).toContain('BEGIN ATOMIC');
        expect(
          scanTopLevel(sql).find((segment) => segment.start === start)
        ).toEqual({
          kind: 'statement',
          text: sql.slice(start, end),
          start,
          line: lineAt(sql, start),
        });
      }
    );

    it.each([
      {
        name: 'a function',
        sql: 'CREATE FUNCTION f() RETURNS integer\n    LANGUAGE sql\n    BEGIN ATOMIC\n SELECT 1;\n SELECT 2;\nEND;\nSELECT 3;\n',
        statements: [
          'CREATE FUNCTION f() RETURNS integer\n    LANGUAGE sql\n    BEGIN ATOMIC\n SELECT 1;\n SELECT 2;\nEND;',
          'SELECT 3;',
        ],
      },
      {
        name: 'a procedure made with OR REPLACE',
        sql: 'CREATE OR REPLACE PROCEDURE p()\n    LANGUAGE sql\n    BEGIN ATOMIC\n INSERT INTO t VALUES (1);\n INSERT INTO t VALUES (2);\nEND;\nCALL p();\n',
        statements: [
          'CREATE OR REPLACE PROCEDURE p()\n    LANGUAGE sql\n    BEGIN ATOMIC\n INSERT INTO t VALUES (1);\n INSERT INTO t VALUES (2);\nEND;',
          'CALL p();',
        ],
      },
      {
        name: 'lower-case keywords',
        sql: 'create function f() returns integer language sql begin atomic select 1; select 2; end; select 3;',
        statements: [
          'create function f() returns integer language sql begin atomic select 1; select 2; end;',
          'select 3;',
        ],
      },
      {
        name: 'CASE … END expressions, nested too',
        sql: "CREATE FUNCTION f(x integer) RETURNS text\n    LANGUAGE sql\n    BEGIN ATOMIC\n SELECT CASE WHEN x > 0 THEN 'positive' ELSE 'other' END;\n SELECT CASE WHEN x > 9 THEN CASE WHEN x > 99 THEN 'huge' ELSE 'big' END ELSE 'small' END;\nEND;\nSELECT 2;\n",
        statements: [
          "CREATE FUNCTION f(x integer) RETURNS text\n    LANGUAGE sql\n    BEGIN ATOMIC\n SELECT CASE WHEN x > 0 THEN 'positive' ELSE 'other' END;\n SELECT CASE WHEN x > 9 THEN CASE WHEN x > 99 THEN 'huge' ELSE 'big' END ELSE 'small' END;\nEND;",
          'SELECT 2;',
        ],
      },
      {
        name: 'END, BEGIN and CASE inside quotes and comments',
        sql: `CREATE FUNCTION f() RETURNS text\n    LANGUAGE sql\n    BEGIN ATOMIC\n SELECT 'end;' AS "END"; -- end;\n SELECT $$ begin; $$ /* case; end; */;\nEND;\nSELECT 2;\n`,
        statements: [
          `CREATE FUNCTION f() RETURNS text\n    LANGUAGE sql\n    BEGIN ATOMIC\n SELECT 'end;' AS "END"; -- end;\n SELECT $$ begin; $$ /* case; end; */;\nEND;`,
          'SELECT 2;',
        ],
      },
      {
        name: 'words that only contain END, BEGIN or CASE',
        sql: 'CREATE FUNCTION f() RETURNS bigint\n    LANGUAGE sql\n    BEGIN ATOMIC\n SELECT count(*) FROM weekend_orders WHERE legend AND casement AND beginning_at IS NULL AND ending;\nEND;\nSELECT 2;\n',
        statements: [
          'CREATE FUNCTION f() RETURNS bigint\n    LANGUAGE sql\n    BEGIN ATOMIC\n SELECT count(*) FROM weekend_orders WHERE legend AND casement AND beginning_at IS NULL AND ending;\nEND;',
          'SELECT 2;',
        ],
      },
      {
        name: 'two functions in a row',
        sql: 'CREATE FUNCTION f() RETURNS integer LANGUAGE sql BEGIN ATOMIC SELECT 1; END;\nCREATE FUNCTION g() RETURNS integer LANGUAGE sql BEGIN ATOMIC SELECT 2; END;\n',
        statements: [
          'CREATE FUNCTION f() RETURNS integer LANGUAGE sql BEGIN ATOMIC SELECT 1; END;',
          'CREATE FUNCTION g() RETURNS integer LANGUAGE sql BEGIN ATOMIC SELECT 2; END;',
        ],
      },
      {
        name: 'an unterminated body, up to the end of the input',
        sql: 'CREATE FUNCTION f() RETURNS integer LANGUAGE sql BEGIN ATOMIC SELECT 1; SELECT 2;',
        statements: [
          'CREATE FUNCTION f() RETURNS integer LANGUAGE sql BEGIN ATOMIC SELECT 1; SELECT 2;',
        ],
      },
    ])(
      'keeps the BEGIN ATOMIC body of $name in one statement',
      ({ sql, statements }) => {
        expect(significant(sql)).toEqual(
          statements.map((statement) => ['statement', statement])
        );
      }
    );

    it.each([
      {
        name: 'a function without BEGIN ATOMIC',
        sql: 'CREATE FUNCTION f(x integer) RETURNS integer\n    LANGUAGE sql\n    RETURN CASE WHEN x > 0 THEN 1 ELSE 0 END;\nSELECT 2;\n',
        statements: [
          'CREATE FUNCTION f(x integer) RETURNS integer\n    LANGUAGE sql\n    RETURN CASE WHEN x > 0 THEN 1 ELSE 0 END;',
          'SELECT 2;',
        ],
      },
      {
        name: 'a function with a dollar-quoted PL/pgSQL body',
        sql: 'CREATE FUNCTION f() RETURNS trigger\n    LANGUAGE plpgsql\n    AS $$\nBEGIN\n    RETURN NEW;\nEND;\n$$;\nSELECT 2;\n',
        statements: [
          'CREATE FUNCTION f() RETURNS trigger\n    LANGUAGE plpgsql\n    AS $$\nBEGIN\n    RETURN NEW;\nEND;\n$$;',
          'SELECT 2;',
        ],
      },
      {
        name: 'BEGIN, CASE and END outside CREATE FUNCTION',
        sql: 'BEGIN;\nSELECT CASE WHEN true THEN 1 END;\nEND;\n',
        statements: ['BEGIN;', 'SELECT CASE WHEN true THEN 1 END;', 'END;'],
      },
    ])('ends $name at its first top-level semicolon', ({ sql, statements }) => {
      expect(significant(sql)).toEqual(
        statements.map((statement) => ['statement', statement])
      );
    });
  });

  describe('line numbers', () => {
    it('gives each segment the 1-based line of its first character', () => {
      expect(
        scanTopLevel(
          'SELECT 1;\n\n  SELECT\n  2;\n-- c\n\\connect x\nSELECT 3;'
        ).filter((segment) => segment.kind !== 'trivia')
      ).toEqual([
        { kind: 'statement', text: 'SELECT 1;', start: 0, line: 1 },
        { kind: 'statement', text: 'SELECT\n  2;', start: 13, line: 3 },
        { kind: 'meta', text: '\\connect x\n', start: 30, line: 6 },
        { kind: 'statement', text: 'SELECT 3;', start: 41, line: 7 },
      ]);
    });

    it('finds the BEGIN ATOMIC function of the PostgreSQL 18 kitchen-sink dump on line 356', () => {
      const dump = CAPTURED_DUMPS.find(
        (candidate) => candidate.name === 'pg18/kitchen-sink'
      );

      expect(
        scanTopLevel(dump?.sql ?? '').find((segment) =>
          segment.text.startsWith('CREATE FUNCTION kitchen.order_count(')
        )?.line
      ).toBe(356);
    });
  });
});
