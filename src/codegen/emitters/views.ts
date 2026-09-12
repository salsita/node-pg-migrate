import type { View } from '../../introspect/types';
import type { Code } from '../code';
import { func, object, raw, statement, str } from '../code';
import { nameCode } from '../names';
import { qualifiedName, quoteName, storageParameters } from '../sql';
import type { EmitContext, Emitted } from '../types';
import { withStatements } from './fallback';

/**
 * A view option (`reloptions` entry) that `ViewOptions` writes back as it is
 * stored: a plain name and a value that needs no quotes.
 */
const PLAIN_OPTION = /^(?<name>[_a-z][\d_a-z]*)=(?<value>[\w.+-]+)$/;

/**
 * The options as `ViewOptions`, or `undefined` when one of them is not a
 * plain `name=value`: `ViewOptions` writes its values without quotes.
 */
function viewOptions(options: ReadonlyArray<string>): Code | undefined {
  const entries: Array<readonly [string, Code]> = [];
  for (const option of options) {
    const groups = PLAIN_OPTION.exec(option)?.groups;
    if (groups === undefined) {
      return undefined;
    }

    const { name, value } = groups;
    entries.push([
      name,
      value === 'true' || value === 'false' ? raw(value) : str(value),
    ]);
  }

  return object(entries);
}

/**
 * `pgm.createView(name, { checkOption, options }, definition)`, then
 * `pgm.alterViewColumn(name, column, { default: pgm.func(…) })` for each
 * column with a default.
 *
 * Fallback (`CREATE VIEW … AS <definition>` built from the model, then
 * `ALTER VIEW … ALTER COLUMN … SET DEFAULT …` for the defaults) when an
 * option is one `ViewOptions` cannot express (its value would need quotes),
 * reason `'view options'`.
 *
 * @param view The view.
 * @param ctx The migration context.
 */
export function emitView(view: View, ctx: EmitContext): Emitted {
  const defaults = view.columns.flatMap((column) =>
    column.default === undefined
      ? []
      : [{ column: column.name, expression: column.default }]
  );
  const options = viewOptions(view.options);
  if (options === undefined) {
    const name = qualifiedName(view);
    const checkOption =
      view.checkOption === undefined
        ? ''
        : ` WITH ${view.checkOption} CHECK OPTION`;

    return withStatements(
      '',
      [
        `CREATE VIEW ${name} WITH (${storageParameters(view.options)}) AS ${view.definition}${checkOption};`,
        ...defaults.map(
          ({ column, expression }) =>
            `ALTER VIEW ${name} ALTER COLUMN ${quoteName(column)} SET DEFAULT ${expression};`
        ),
      ],
      ['view options']
    );
  }

  const code = [
    statement('createView', [
      nameCode(view, ctx),
      object([
        [
          'checkOption',
          view.checkOption === undefined ? undefined : str(view.checkOption),
        ],
        ['options', view.options.length === 0 ? undefined : options],
      ]),
      str(view.definition),
    ]),
    ...defaults.map(({ column, expression }) =>
      statement('alterViewColumn', [
        nameCode(view, ctx),
        str(column),
        object([['default', func(expression)]]),
      ])
    ),
  ];

  return { kind: 'code', code: code.join('\n') };
}
