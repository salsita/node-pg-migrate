import { describe, expect, it } from 'vitest';
import { createSchemalize } from '../../src/utils';

describe('utils', () => {
  describe('createSchemalize', () => {
    it.each([
      [true, true],
      [true, false],
      [false, true],
      [false, false],
    ])('should return a function', (shouldDecamelize, shouldQuote) => {
      const actual = createSchemalize({
        shouldDecamelize,
        shouldQuote,
      });

      expect(actual).toBeTypeOf('function');
    });

    it('should decamelize and quote for string', () => {
      const schemalize = createSchemalize({
        shouldDecamelize: true,
        shouldQuote: true,
      });

      const actual = schemalize('myTable');

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('"my_table"');
    });

    it('should decamelize and quote for schema', () => {
      const schemalize = createSchemalize({
        shouldDecamelize: true,
        shouldQuote: true,
      });

      const actual = schemalize({ schema: 'mySchema', name: 'myTable' });

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('"my_schema"."my_table"');
    });

    it('should only decamelize for string', () => {
      const schemalize = createSchemalize({
        shouldDecamelize: true,
        shouldQuote: false,
      });

      const actual = schemalize('myTable');

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('my_table');
    });

    it('should only decamelize for schema', () => {
      const schemalize = createSchemalize({
        shouldDecamelize: true,
        shouldQuote: false,
      });

      const actual = schemalize({ schema: 'mySchema', name: 'myTable' });

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('my_schema.my_table');
    });

    it('should only quote for string', () => {
      const schemalize = createSchemalize({
        shouldDecamelize: false,
        shouldQuote: true,
      });

      const actual = schemalize('myTable');

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('"myTable"');
    });

    it('should only quote for schema', () => {
      const schemalize = createSchemalize({
        shouldDecamelize: false,
        shouldQuote: true,
      });

      const actual = schemalize({ schema: 'mySchema', name: 'myTable' });

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('"mySchema"."myTable"');
    });

    it('should not decamelize and quote for string', () => {
      const schemalize = createSchemalize({
        shouldDecamelize: false,
        shouldQuote: false,
      });

      const actual = schemalize('myTable');

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('myTable');
    });

    it('should not decamelize and quote for schema', () => {
      const schemalize = createSchemalize({
        shouldDecamelize: false,
        shouldQuote: false,
      });

      const actual = schemalize({ schema: 'mySchema', name: 'myTable' });

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe('mySchema.myTable');
    });

    // TODO @Shinigami92 2024-04-03: Should this throw an error?
    it.each([
      [true, true, '""'],
      [true, false, ''],
      [false, true, '""'],
      [false, false, ''],
    ])(
      'should return empty string',
      (shouldDecamelize, shouldQuote, expected) => {
        const schemalize = createSchemalize({
          shouldDecamelize,
          shouldQuote,
        });

        const actual = schemalize('');

        expect(actual).toBeTypeOf('string');
        expect(actual).toBe(expected);
      }
    );

    it.each([
      [true, true, '"my_table"'],
      [true, false, 'my_table'],
      [false, true, '"myTable"'],
      [false, false, 'myTable'],
    ])('should accept only name', (shouldDecamelize, shouldQuote, expected) => {
      const schemalize = createSchemalize({
        shouldDecamelize,
        shouldQuote,
      });

      const actual = schemalize({ name: 'myTable' });

      expect(actual).toBeTypeOf('string');
      expect(actual).toBe(expected);
    });

    it('should detect and wrap expression', () => {
      const schemalize = createSchemalize({
        shouldDecamelize: true,
        shouldQuote: false,
      });

      const actual = schemalize("contentSub->>'id'");

      expect(actual).toBe("(contentSub->>'id')");
    });

    it('should detect and wrap function call', () => {
      const schemalize = createSchemalize({
        shouldDecamelize: true,
        shouldQuote: false,
      });

      const actual = schemalize('lower(email)');

      expect(actual).toBe('(lower(email))');
    });

    it('should detect and wrap arithmetic expression', () => {
      const schemalize = createSchemalize({
        shouldDecamelize: true,
        shouldQuote: false,
      });

      const actual = schemalize('value * 100');

      expect(actual).toBe('(value * 100)');
    });

    it('should not detect arithmetic expression without spaces', () => {
      const schemalize = createSchemalize({
        shouldDecamelize: true,
        shouldQuote: true,
      });

      const actual = schemalize('value*100');

      expect(actual).toBe('"value*100"');
    });

    it('should detect and wrap schema qualified function call', () => {
      const schemalize = createSchemalize({
        shouldDecamelize: true,
        shouldQuote: false,
      });

      const actual = schemalize('myschema.myfunction(col)');

      expect(actual).toBe('(myschema.myfunction(col))');
    });

    it('should handle PgLiteral', () => {
      const schemalize = createSchemalize({
        shouldDecamelize: true,
        shouldQuote: true,
      });

      const pgLiteral = { literal: true, toString: () => 'some_literal' };
      // @ts-expect-error: Testing PgLiteral duck typing
      const actual = schemalize(pgLiteral);

      expect(actual).toBe('some_literal');
    });

    it('should escape double quotes when quoting identifiers', () => {
      const schemalize = createSchemalize({
        shouldDecamelize: false,
        shouldQuote: true,
      });

      const actual = schemalize('my"Table');

      expect(actual).toBe('"my""Table"');
    });

    it.each(['--', ';', '!=', '>'])(
      'should not treat standalone operators or tokens as expressions: %s',
      (token) => {
        const schemalize = createSchemalize({
          shouldDecamelize: false,
          shouldQuote: false,
        });

        expect(schemalize(token)).toBe(token);
      }
    );

    it.each([
      ["contentSub->'id'", "(contentSub->'id')"],
      ["contentSub->>'id'", "(contentSub->>'id')"],
      ["contentSub#>'{a,b}'", "(contentSub#>'{a,b}')"],
      ["contentSub#>>'{a,b}'", "(contentSub#>>'{a,b}')"],
      ['meta @> \'{"a":1}\'', '(meta @> \'{"a":1}\')'],
      ['meta <@ \'{"a":1}\'', '(meta <@ \'{"a":1}\')'],
      ["meta ? 'a'", "(meta ? 'a')"],
      ["meta ?| array['a','b']", "(meta ?| array['a','b'])"],
      ["meta ?& array['a','b']", "(meta ?& array['a','b'])"],
      ['meta || \'{"b":2}\'', '(meta || \'{"b":2}\')'],
      ["meta - 'a'", "(meta - 'a')"],
      ["meta #- '{a,b}'", "(meta #- '{a,b}')"],
      ["meta @? '$.a ? (@ == 1)'", "(meta @? '$.a ? (@ == 1)')"],
      ["meta @@ '$.a == 1'", "(meta @@ '$.a == 1')"],
    ])(
      'should detect and wrap json operator expression: %s',
      (expr, expected) => {
        const schemalize = createSchemalize({
          shouldDecamelize: false,
          shouldQuote: false,
        });

        expect(schemalize(expr)).toBe(expected);
      }
    );

    describe('sql injection hardening', () => {
      it.each([
        // classic comment-based
        'x"; DROP TABLE users; --',
        'x"; SELECT pg_sleep(1); --',
        "x' OR '1'='1", // value-style payload, but must not break identifier quoting
        // stacked queries
        'x;DROP TABLE users',
        // block comments
        'x*/ DROP TABLE users; /*',
        'x/*comment*/y',
        // postgres dollar-quoting
        'x$$; DROP TABLE users;$$',
        // union/select
        'x UNION SELECT 1,2,3',
        // pg-specific
        'x); SELECT current_database(); --',
        // whitespace / newline comment tricks
        'x\n--comment',
        'x\r\n--comment',
        // backslash escapes (driver-dependent, still should be safe in identifiers)
        'x\\"; DROP TABLE users; --',
      ])('should keep quoted identifiers safe for payload: %s', (payload) => {
        const literal = createSchemalize({
          shouldDecamelize: false,
          shouldQuote: true,
        });

        const actual = literal(payload);

        // Safety contract: we must end up with one quoted identifier; embedded quotes are escaped.
        const escaped = payload.replace(/"/g, '""');
        expect(actual).toBe(`"${escaped}"`);
      });

      it('should keep schema-qualified quoted identifiers safe', () => {
        const literal = createSchemalize({
          shouldDecamelize: false,
          shouldQuote: true,
        });

        const schema = 'public"; DROP SCHEMA public; --';
        const name = 'users"; DROP TABLE users; --';

        const actual = literal({ schema, name });

        expect(actual).toBe(
          `"${schema.replace(/"/g, '""')}"."${name.replace(/"/g, '""')}"`
        );
      });

      it.each([
        // Things that must never be treated as expressions on their own.
        '--',
        ';',
        '/* */',
        '/*comment*/',
        '*/',
        '$$',
      ])('should not treat token-only payload as expression: %s', (token) => {
        const schemalize = createSchemalize({
          shouldDecamelize: false,
          shouldQuote: false,
        });

        expect(schemalize(token)).toBe(token);
      });

      it('should wrap expression-shaped injection attempts when not quoting (treat as raw expression)', () => {
        const schemalize = createSchemalize({
          shouldDecamelize: false,
          shouldQuote: false,
        });

        // In non-quoting mode, expression detection intentionally wraps expressions.
        // This is NOT a sanitizer, but we ensure consistent behavior.
        expect(schemalize('lower(email)); DROP TABLE users; --')).toBe(
          '(lower(email)); DROP TABLE users; --)'
        );
      });
    });
  });
});
