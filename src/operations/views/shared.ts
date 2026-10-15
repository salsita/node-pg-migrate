import { formatOption, quoteOptionName } from '../../utils';
import type { Nullable } from '../generalTypes';

export type ViewOptions = {
  [key: string]: boolean | number | string;
};

export function viewOptionStr<TViewOptions extends Nullable<ViewOptions>>(
  options: TViewOptions
): (key: keyof TViewOptions) => string {
  return (key) => {
    const name = String(key);
    const value = options[key];
    // information_schema.views recognizes only lowercase check_option values.
    const normalizedValue =
      name.toLowerCase() === 'check_option' && typeof value === 'string'
        ? value.toLowerCase()
        : value;

    return formatOption(quoteOptionName(name), normalizedValue);
  };
}
