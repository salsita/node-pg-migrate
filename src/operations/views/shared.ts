import { formatOption, quoteOptionName } from '../../utils';
import type { Nullable } from '../generalTypes';

export type ViewOptions = {
  [key: string]: boolean | number | string;
};

export function viewOptionStr<TViewOptions extends Nullable<ViewOptions>>(
  options: TViewOptions
): (key: keyof TViewOptions) => string {
  return (key) => formatOption(String(key), options[key], quoteOptionName);
}
