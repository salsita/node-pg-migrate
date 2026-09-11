import { describe, expect, it } from 'vitest';
import { formatQueryError } from '../../src/utils';

describe('formatQueryError', () => {
  const message = 'syntax error at or near "oops"';

  /** The caret under `oops` in `SELECT oops;`. */
  const caret = `${' '.repeat(7)}^^^^`;

  /**
   * `SELECT 1;` to `SELECT <count>;`, one statement per line, with
   * `SELECT oops;` as the 1-based line `errorLine`.
   */
  function statementLines(count: number, errorLine?: number): string[] {
    const lines = Array.from(
      { length: count },
      (_, index) => `SELECT ${index + 1};`
    );
    if (errorLine !== undefined) {
      lines[errorLine - 1] = 'SELECT oops;';
    }

    return lines;
  }

  /** The error at `oops`, with the 1-based position as a string like pg's. */
  function oopsError(sql: string): Error {
    return Object.assign(new Error(message), {
      position: String(sql.indexOf('oops') + 1),
    });
  }

  /** What is logged for the error at `oops`, given the lines shown. */
  function logged(excerpt: ReadonlyArray<string>): string {
    return ['Error executing:', ...excerpt, '', message, ''].join('\n');
  }

  describe('with an error position', () => {
    it('should show a query of 21 lines in full', () => {
      const lines = statementLines(21, 21);
      const sql = lines.join('\n');

      expect(formatQueryError(sql, oopsError(sql))).toBe(
        logged([...lines, caret])
      );
    });

    it('should cut a query of 22 lines', () => {
      const lines = statementLines(22, 1);
      const sql = lines.join('\n');

      expect(formatQueryError(sql, oopsError(sql))).toBe(
        logged([
          lines[0],
          caret,
          ...lines.slice(1, 11),
          '... (11 lines omitted)',
        ])
      );
    });

    it('should show the lines on both sides of the error', () => {
      const lines = statementLines(50, 25);
      const sql = lines.join('\n');

      expect(formatQueryError(sql, oopsError(sql))).toBe(
        logged([
          '... (14 lines omitted)',
          ...lines.slice(14, 25),
          caret,
          ...lines.slice(25, 35),
          '... (15 lines omitted)',
        ])
      );
    });

    it('should show no lines before an error on the first line', () => {
      const lines = statementLines(30, 1);
      const sql = lines.join('\n');

      expect(formatQueryError(sql, oopsError(sql))).toBe(
        logged([
          lines[0],
          caret,
          ...lines.slice(1, 11),
          '... (19 lines omitted)',
        ])
      );
    });

    it('should show no lines after an error on the last line', () => {
      const lines = statementLines(30, 30);
      const sql = lines.join('\n');

      expect(formatQueryError(sql, oopsError(sql))).toBe(
        logged(['... (19 lines omitted)', ...lines.slice(19), caret])
      );
    });

    it('should omit no lines before an error 10 lines from the start', () => {
      const lines = statementLines(30, 11);
      const sql = lines.join('\n');

      expect(formatQueryError(sql, oopsError(sql))).toBe(
        logged([
          ...lines.slice(0, 11),
          caret,
          ...lines.slice(11, 21),
          '... (9 lines omitted)',
        ])
      );
    });

    it('should omit no lines after an error 10 lines from the end', () => {
      const lines = statementLines(30, 20);
      const sql = lines.join('\n');

      expect(formatQueryError(sql, oopsError(sql))).toBe(
        logged([
          '... (9 lines omitted)',
          ...lines.slice(9, 20),
          caret,
          ...lines.slice(20),
        ])
      );
    });

    it('should put the caret after the last line for an error at the end of input', () => {
      const lines = [...statementLines(29), 'SELECT 30 +'];
      const sql = lines.join('\n');
      const error = Object.assign(new Error('syntax error at end of input'), {
        position: String(sql.length + 1),
      });

      expect(formatQueryError(sql, error)).toBe(
        [
          'Error executing:',
          '... (19 lines omitted)',
          ...lines.slice(19),
          `${' '.repeat(11)}^^^^`,
          '',
          'syntax error at end of input',
          '',
        ].join('\n')
      );
    });

    it('should put the caret after the line when the position is at its line break', () => {
      const error = Object.assign(new Error(message), { position: '9' });

      expect(formatQueryError('SELECT 1\nFROM t', error)).toBe(
        logged(['SELECT 1', `${' '.repeat(8)}^^^^`, 'FROM t'])
      );
    });

    it('should split lines at `\\n` only, keeping a `\\r` before it', () => {
      const sql = 'SELECT 1;\r\nSELECT oops;\r\nSELECT 3;';

      expect(formatQueryError(sql, oopsError(sql))).toBe(
        logged(['SELECT 1;\r', 'SELECT oops;\r', caret, 'SELECT 3;'])
      );
    });

    it('should accept the position as a number', () => {
      const lines = statementLines(3, 2);
      const sql = lines.join('\n');
      const error = Object.assign(new Error(message), {
        position: sql.indexOf('oops') + 1,
      });

      expect(formatQueryError(sql, error)).toBe(
        logged([lines[0], lines[1], caret, lines[2]])
      );
    });
  });

  describe('without an error position', () => {
    it('should show a query of 21 lines in full', () => {
      const sql = statementLines(21).join('\n');

      expect(formatQueryError(sql, new Error('boom'))).toBe(
        `Error executing:\n${sql}\nError: boom\n`
      );
    });

    it('should cut a query of 22 lines to its first 21', () => {
      const lines = statementLines(22);

      expect(formatQueryError(lines.join('\n'), new Error('boom'))).toBe(
        [
          'Error executing:',
          ...lines.slice(0, 21),
          '... (1 lines omitted)',
          'Error: boom',
          '',
        ].join('\n')
      );
    });

    it.each(['0', '-3', 'abc', ''])(
      'should ignore the position %j',
      (position) => {
        const lines = statementLines(30);
        const error = Object.assign(new Error('boom'), { position });

        expect(formatQueryError(lines.join('\n'), error)).toBe(
          [
            'Error executing:',
            ...lines.slice(0, 21),
            '... (9 lines omitted)',
            'Error: boom',
            '',
          ].join('\n')
        );
      }
    );

    it('should ignore the position of an error without a message', () => {
      const lines = statementLines(30, 1);
      const sql = lines.join('\n');
      const error = Object.assign(new Error(''), {
        position: String(sql.indexOf('oops') + 1),
      });

      expect(formatQueryError(sql, error)).toBe(
        [
          'Error executing:',
          ...lines.slice(0, 21),
          '... (9 lines omitted)',
          'Error',
          '',
        ].join('\n')
      );
    });

    it('should show `undefined` for a prepared statement run by its name alone', () => {
      expect(formatQueryError(undefined, new Error('boom'))).toBe(
        'Error executing:\nundefined\nError: boom\n'
      );
    });
  });
});
