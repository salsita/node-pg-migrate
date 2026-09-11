import { describe, expect, it } from 'vitest';
import { copiesFromStdin, scanTopLevel } from '../../../src/baseline/core/scan';
import type { SegmentKind } from '../../../src/baseline/types';

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

describe('scanTopLevel', () => {
  describe('parentheses, like psql', () => {
    it('keeps the semicolons of a rule with several actions in its statement', () => {
      const rule =
        'CREATE RULE r AS\n    ON INSERT TO public.t DO INSTEAD ( INSERT INTO public.a (x)\n  VALUES (new.x);\n INSERT INTO public.b (x)\n  VALUES (new.x);\n);';

      expect(statementsOf(`${rule}\nSELECT 2;\n`)).toEqual([rule, 'SELECT 2;']);
    });

    it('ignores a closing parenthesis without an opening one', () => {
      expect(statementsOf('SELECT 1); SELECT (2);')).toEqual([
        'SELECT 1);',
        'SELECT (2);',
      ]);
    });

    it('ignores BEGIN, CASE and END inside parentheses of a BEGIN ATOMIC body', () => {
      const fn =
        'CREATE FUNCTION f() RETURNS integer LANGUAGE sql BEGIN ATOMIC SELECT (CASE WHEN true THEN 1 END); SELECT f(begin); END;';

      expect(statementsOf(`${fn}\nSELECT 2;`)).toEqual([fn, 'SELECT 2;']);
    });
  });

  describe('BEGIN ATOMIC', () => {
    it.each([
      {
        name: 'a comment between BEGIN and ATOMIC',
        sql: 'CREATE FUNCTION f() RETURNS integer LANGUAGE sql BEGIN /* body */ ATOMIC SELECT 1; END;',
      },
      {
        name: 'a nested BEGIN … END',
        sql: 'CREATE PROCEDURE p() LANGUAGE sql BEGIN ATOMIC SELECT 1; BEGIN SELECT 2; END; END;',
      },
    ])('keeps $name in one statement', ({ sql }) => {
      expect(statementsOf(`${sql} SELECT 3;`)).toEqual([sql, 'SELECT 3;']);
    });

    it.each([
      {
        name: 'a function named begin',
        sql: 'CREATE FUNCTION public.begin() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;',
      },
      {
        name: 'BEGIN without ATOMIC in a function',
        sql: 'CREATE FUNCTION f() RETURNS integer LANGUAGE sql BEGIN;',
      },
      {
        name: 'CREATE OR REPLACE of something else than a routine',
        sql: 'CREATE OR REPLACE VIEW v AS SELECT CASE WHEN true THEN 1 END AS x;',
      },
      {
        name: 'CREATE OR something else',
        sql: 'CREATE OR FUNCTION f() BEGIN ATOMIC SELECT 1;',
      },
    ])('ends $name at its first top-level semicolon', ({ sql }) => {
      expect(statementsOf(`${sql} SELECT 3;`)).toEqual([sql, 'SELECT 3;']);
    });
  });

  describe('identifiers, strings and dollar quotes', () => {
    it.each([
      {
        name: 'a $ inside an identifier, which does not start a dollar quote',
        sql: 'SELECT a$b$ FROM t; SELECT $b$;$b$;',
        statements: ['SELECT a$b$ FROM t;', 'SELECT $b$;$b$;'],
      },
      {
        name: 'a word ending in E before a string, which is not an E string',
        sql: String.raw`SELECT namE'\'; SELECT 2;`,
        statements: [String.raw`SELECT namE'\';`, 'SELECT 2;'],
      },
      {
        name: 'a number ending in e before a string, which is not an E string',
        sql: String.raw`SELECT 1e'\'; SELECT 2;`,
        statements: [String.raw`SELECT 1e'\';`, 'SELECT 2;'],
      },
      {
        name: 'a dollar-quote tag with non-ASCII letters',
        sql: 'SELECT $día$ ; $día$; SELECT 2;',
        statements: ['SELECT $día$ ; $día$;', 'SELECT 2;'],
      },
      {
        name: 'a lone dollar sign',
        sql: 'SELECT $ ; SELECT 2;',
        statements: ['SELECT $ ;', 'SELECT 2;'],
      },
      {
        name: 'a Unicode escape string',
        sql: "SELECT U&'d\\0061t;a'; SELECT 2;",
        statements: ["SELECT U&'d\\0061t;a';", 'SELECT 2;'],
      },
      {
        name: 'a comment that ends with a carriage return',
        sql: 'SELECT 1 -- ;\r; SELECT 2;',
        statements: ['SELECT 1 -- ;\r;', 'SELECT 2;'],
      },
      {
        name: 'asterisks and slashes in a block comment',
        sql: 'SELECT 1 /** ; **/ / 2; SELECT 2;',
        statements: ['SELECT 1 /** ; **/ / 2;', 'SELECT 2;'],
      },
      {
        name: 'non-BMP characters in an identifier',
        sql: 'SELECT 1 AS 𝒳; SELECT 2;',
        statements: ['SELECT 1 AS 𝒳;', 'SELECT 2;'],
      },
    ])('reads $name', ({ sql, statements }) => {
      expect(statementsOf(sql)).toEqual(statements);
    });
  });

  describe('psql meta-commands', () => {
    it('starts a meta-command at a backslash after a statement on the same line', () => {
      expect(significant('SELECT 1; \\connect app\nSELECT 2;\n')).toEqual([
        ['statement', 'SELECT 1;'],
        ['meta', '\\connect app\n'],
        ['statement', 'SELECT 2;'],
      ]);
    });

    it('keeps a backslash line outside quotes inside a statement', () => {
      expect(significant('SELECT 1\n\\connect app\n;\n')).toEqual([
        ['statement', 'SELECT 1\n\\connect app\n;'],
      ]);
    });
  });

  describe('COPY data', () => {
    it.each([
      {
        name: 'a \\. line that ends with \\r\\n',
        sql: 'COPY t FROM stdin;\r\n1\r\n\\.\r\nSELECT 1;\r\n',
        data: '\r\n1\r\n\\.\r\n',
      },
      {
        name: 'lines that only start like the end of the data',
        sql: 'COPY t FROM stdin;\n\\.x\n\\.\\.\n\\.\nSELECT 1;\n',
        data: '\n\\.x\n\\.\\.\n\\.\n',
      },
      {
        name: 'a statement on the line of the COPY',
        sql: 'COPY t FROM stdin; SELECT 1;\n1\n\\.\nSELECT 2;\n',
        data: ' SELECT 1;\n1\n\\.\n',
      },
    ])('ends COPY data after $name', ({ sql, data }) => {
      expect(significant(sql)).toEqual([
        ['statement', 'COPY t FROM stdin;'],
        ['copy-data', data],
        ['statement', sql.slice(sql.indexOf(data) + data.length).trimEnd()],
      ]);
    });

    it('reads no data after a COPY that is not terminated', () => {
      expect(significant('COPY t FROM stdin')).toEqual([
        ['statement', 'COPY t FROM stdin'],
      ]);
    });
  });
});

describe('copiesFromStdin', () => {
  it.each([
    { statement: 'COPY t FROM stdin;', expected: true },
    {
      statement: 'copy t (a, "b") from STDIN with (format csv);',
      expected: true,
    },
    { statement: 'COPY t FROM -- the data\n stdin;', expected: true },
    { statement: 'COPY t TO stdout;', expected: false },
    { statement: "COPY t FROM 'stdin';", expected: false },
    { statement: 'COPY (SELECT * FROM stdin) TO stdout;', expected: false },
    { statement: 'SELECT * FROM stdin;', expected: false },
    { statement: 'COPY t FROM stdin_file;', expected: false },
    { statement: 'COPY t FROM (stdin);', expected: false },
  ])('is $expected for $statement', ({ statement, expected }) => {
    expect(copiesFromStdin(statement)).toBe(expected);
  });
});
