import type { Nullable } from '../generalTypes';

export type ViewOptions = {
  [key: string]: boolean | number | string;
};

export function viewOptionStr<TViewOptions extends Nullable<ViewOptions>>(
  options: TViewOptions
): (key: keyof TViewOptions) => string {
  return (key) => {
    const value = options[key] === true ? '' : ` = ${options[key]}`;

    return `${String(key)}${value}`;
  };
}
