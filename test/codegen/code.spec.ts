import { runInThisContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  array,
  func,
  isEmpty,
  num,
  object,
  propertyKey,
  raw,
  statement,
  str,
} from '../../src/codegen/code';

function evaluate(code: string): unknown {
  return runInThisContext(`(${code})`);
}

describe('propertyKey', () => {
  it.each([
    ['id', 'id'],
    ['$x_1', '$x_1'],
    ['default', 'default'],
    ['Order Date', "'Order Date'"],
    ['1', "'1'"],
    ['a-b', "'a-b'"],
    ['__proto__', "['__proto__']"],
  ])('writes the key %s as %s', (name, expected) => {
    expect(propertyKey(name)).toBe(expected);
  });

  it('makes a property named __proto__ instead of setting the prototype', () => {
    const value = evaluate(object([['__proto__', str('text')]]).text);

    expect(Object.keys(value as object)).toStrictEqual(['__proto__']);
  });
});

describe('object and array', () => {
  it('leave out undefined values and write empty ones compactly', () => {
    const value = object([
      ['a', num(1)],
      ['skipped', undefined],
      ['b', array([str('x'), raw('true')])],
    ]);

    expect(value.text).toBe("{ a: 1, b: ['x', true] }");
    expect(object([]).text).toBe('{}');
    expect(array([]).text).toBe('[]');
    expect(isEmpty(object([]))).toBe(true);
    expect(isEmpty(array([]))).toBe(true);
    expect(isEmpty(value)).toBe(false);
    expect(isEmpty(str(''))).toBe(false);
  });

  it('writes pgm.func() for SQL expressions', () => {
    expect(func("'it''s'::text").text).toBe(
      String.raw`pgm.func('\'it\'\'s\'::text')`
    );
  });
});

describe('statement', () => {
  it('writes a call that fits on one line', () => {
    expect(
      statement('createSchema', [
        str('app'),
        object([['ifNotExists', raw('true')]]),
      ])
    ).toBe("pgm.createSchema('app', { ifNotExists: true });");
  });

  it('keeps a single long string on the line of its call', () => {
    const sql = `SELECT ${'x, '.repeat(40)}1`;

    expect(statement('sql', [str(sql)])).toBe(`pgm.sql('${sql}');`);
  });

  it('breaks only the last argument when it is an object and the rest fits', () => {
    const code = statement('createType', [
      str('mood'),
      array(['sad', 'ok', 'happy', 'ecstatic', 'meh', 'grumpy'].map(str)),
    ]);

    expect(code).toBe(
      [
        "pgm.createType('mood', ['sad', 'ok', 'happy', 'ecstatic', 'meh', 'grumpy']);",
      ].join('\n')
    );

    const long = statement('createType', [
      str('mood'),
      array(
        [
          'sad',
          'ok',
          'happy',
          'ecstatic',
          'meh',
          'grumpy',
          'elated',
          'cross',
        ].map(str)
      ),
    ]);

    expect(long).toBe(
      [
        "pgm.createType('mood', [",
        "  'sad',",
        "  'ok',",
        "  'happy',",
        "  'ecstatic',",
        "  'meh',",
        "  'grumpy',",
        "  'elated',",
        "  'cross',",
        ']);',
      ].join('\n')
    );
  });

  it('breaks every argument, and the objects that do not fit, with trailing commas in objects only', () => {
    const code = statement('createTable', [
      str('a_table_with_a_rather_long_name_for_the_example'),
      object([
        [
          'id',
          object([
            ['type', str('integer')],
            ['notNull', raw('true')],
          ]),
        ],
        [
          'description',
          object([
            ['type', str('text')],
            [
              'comment',
              str('A description that is long enough to need its own line'),
            ],
          ]),
        ],
      ]),
      object([['comment', str('Things')]]),
    ]);

    expect(code).toBe(
      [
        'pgm.createTable(',
        "  'a_table_with_a_rather_long_name_for_the_example',",
        '  {',
        "    id: { type: 'integer', notNull: true },",
        '    description: {',
        "      type: 'text',",
        "      comment: 'A description that is long enough to need its own line',",
        '    },',
        '  },',
        "  { comment: 'Things' }",
        ');',
      ].join('\n')
    );
    expect(() =>
      runInThisContext(`(function (pgm) {\n${code}\n})`)
    ).not.toThrow();
  });

  it('writes a call without arguments', () => {
    expect(statement('noTransaction', [])).toBe('pgm.noTransaction();');
  });
});
