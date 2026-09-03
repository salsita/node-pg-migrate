import type { Nullable } from '../generalTypes';

export type ViewOptions = {
  [key: string]: boolean | number | string;
};

export function viewOptionStr<
  TViewOptions extends Nullable<ViewOptions>,
  TKey extends keyof TViewOptions,
>(options: TViewOptions): (key: TKey) => string {
  return (key) => {
    const value = options[key] === true ? '' : ` = ${options[key]}`;

    return `${String(key)}${value}`;
  };
}
