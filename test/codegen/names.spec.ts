import { runInThisContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { renderName } from '../../src/codegen/names';
import type { EmitContext } from '../../src/codegen/types';

function evaluate(code: string): unknown {
  return runInThisContext(`(${code})`);
}

const PUBLIC: EmitContext = { defaultSchema: 'public', language: 'ts' };

describe('renderName', () => {
  it.each([
    ['in the default schema', { schema: 'public', name: 'users' }],
    ['without a schema', { name: 'users' }],
  ])('writes a name %s as a string', (_, name) => {
    expect(evaluate(renderName(name, PUBLIC))).toBe('users');
  });

  it('writes a name in another schema as an object', () => {
    expect(
      evaluate(renderName({ schema: 'app', name: 'users' }, PUBLIC))
    ).toStrictEqual({ schema: 'app', name: 'users' });
  });

  it('leaves out the default schema of the migration, which may not be public', () => {
    const ctx: EmitContext = { defaultSchema: 'app', language: 'js' };

    expect(evaluate(renderName({ schema: 'app', name: 'users' }, ctx))).toBe(
      'users'
    );
    expect(
      evaluate(renderName({ schema: 'public', name: 'users' }, ctx))
    ).toStrictEqual({ schema: 'public', name: 'users' });
  });

  it('compares schemas exactly', () => {
    expect(
      evaluate(renderName({ schema: 'Public', name: 'users' }, PUBLIC))
    ).toStrictEqual({ schema: 'Public', name: 'users' });
  });

  it('writes names that need quotes and escapes as they are stored', () => {
    const name = {
      schema: 'Sink Área',
      name: 'Order; Lines "select" it\'s \\ ${x}',
    };

    expect(evaluate(renderName(name, PUBLIC))).toStrictEqual(name);
    expect(
      evaluate(renderName({ schema: 'public', name: name.name }, PUBLIC))
    ).toBe(name.name);
  });
});
