import type { MigrationOptions } from '../../migrationOptions';
import type { Name, Nullable } from '../generalTypes';
import type { ViewOptions } from './shared';
import { viewOptionStr } from './shared';

export interface AlterViewOptions {
  checkOption?: null | 'CASCADED' | 'LOCAL';

  options?: Nullable<ViewOptions>;
}

export type AlterView = (
  viewName: Name,
  viewOptions: AlterViewOptions
) => string;

export function alterView(mOptions: MigrationOptions): AlterView {
  const _alter: AlterView = (viewName, viewOptions) => {
    const { checkOption, options = {} } = viewOptions;

    if (checkOption !== undefined) {
      if (options.check_option === undefined) {
        options.check_option = checkOption;
      } else {
        throw new Error(
          '"options.check_option" and "checkOption" can\'t be specified together'
        );
      }
    }

    const clauses: string[] = [];
    const withOptions = Object.keys(options)
      .filter((key) => options[key] !== null)
      .map(viewOptionStr(options))
      .join(', ');

    if (withOptions) {
      clauses.push(`SET (${withOptions})`);
    }

    const resetOptions = Object.keys(options)
      .filter((key) => options[key] === null)
      .join(', ');

    if (resetOptions) {
      clauses.push(`RESET (${resetOptions})`);
    }

    return clauses
      .map((clause) => `ALTER VIEW ${mOptions.literal(viewName)} ${clause};`)
      .join('\n');
  };

  return _alter;
}
