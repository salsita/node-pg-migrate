import { describe, expect, it } from 'vitest';
import { formatFakeCommand } from '../../../src/baseline/core/fakeCommand';

/**
 * Characters a POSIX shell does something with when they are not quoted.
 */
const UNSAFE_UNQUOTED = /[\s!"#$&'()*;<>?[\\\]`{|}~]/;

/**
 * Splits a command line into the arguments a POSIX shell passes to the
 * program: words separated by whitespace, with `'…'` and `"…"` quoting and
 * backslash escapes.
 *
 * @throws Throws an error when a character the shell would interpret (see
 * {@link UNSAFE_UNQUOTED}) is not quoted, or a quote is not closed.
 */
function shellWords(command: string): string[] {
  const words: string[] = [];
  let word: string | undefined;
  let index = 0;

  while (index < command.length) {
    const char = command.charAt(index);

    if (char === ' ' || char === '\t') {
      if (word !== undefined) {
        words.push(word);
        word = undefined;
      }

      index += 1;
    } else if (char === "'") {
      const end = command.indexOf("'", index + 1);
      if (end < 0) {
        throw new Error(`unterminated single quote in ${command}`);
      }

      word = (word ?? '') + command.slice(index + 1, end);
      index = end + 1;
    } else if (char === '"') {
      let text = '';
      index += 1;
      while (command.charAt(index) !== '"') {
        if (index >= command.length) {
          throw new Error(`unterminated double quote in ${command}`);
        }

        const inner = command.charAt(index);
        if (inner === '$' || inner === '`') {
          throw new Error(
            `unescaped ${inner} inside double quotes in ${command}`
          );
        }

        if (inner === '\\' && '"\\$`'.includes(command.charAt(index + 1))) {
          text += command.charAt(index + 1);
          index += 2;
        } else {
          text += inner;
          index += 1;
        }
      }

      word = (word ?? '') + text;
      index += 1;
    } else if (char === '\\') {
      word = (word ?? '') + command.charAt(index + 1);
      index += 2;
    } else if (UNSAFE_UNQUOTED.test(char)) {
      throw new Error(`unquoted ${char} in ${command}`);
    } else {
      word = (word ?? '') + char;
      index += 1;
    }
  }

  if (word !== undefined) {
    words.push(word);
  }

  return words;
}

const NAME = '1700000000000_baseline';

describe('formatFakeCommand', () => {
  it('records the migration without a directory option for the default directory', () => {
    expect(formatFakeCommand(NAME, 'migrations')).toBe(
      'node-pg-migrate up 1700000000000_baseline --fake'
    );
  });

  it.each([
    'db/migrations',
    'src/db/migrations-v2',
    '/srv/app/migrations',
    '../shared_migrations',
    'migrations2',
  ])('adds the directory %s as given, without quotes', (dir) => {
    expect(formatFakeCommand(NAME, dir)).toBe(
      `node-pg-migrate up 1700000000000_baseline --fake -m ${dir}`
    );
  });

  it('single-quotes a directory with spaces', () => {
    expect(formatFakeCommand(NAME, 'my migrations')).toBe(
      "node-pg-migrate up 1700000000000_baseline --fake -m 'my migrations'"
    );
  });

  it.each([
    'my migrations',
    'tab\there',
    '$HOME/migrations',
    'a;b',
    'a&b',
    'a|b',
    'glob*',
    'what?',
    '(x)',
    'brace{a,b}',
    '[abc]',
    'x<y',
    'redirect>x',
    'back`tick`',
    'excl!',
    "it's",
    'say "hi"',
    "'; rm -rf / #",
  ])('quotes the directory %j so that a POSIX shell passes it as is', (dir) => {
    const command = formatFakeCommand(NAME, dir);

    expect(command).toContain("'");
    expect(shellWords(command)).toEqual([
      'node-pg-migrate',
      'up',
      NAME,
      '--fake',
      '-m',
      dir,
    ]);
  });
});
