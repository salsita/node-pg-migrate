import type { Nullable } from '../generalTypes';

export type StorageParameters = { [key: string]: boolean | number };

export function dataClause(data?: boolean): string {
  return data === undefined ? '' : ` WITH${data ? '' : ' NO'} DATA`;
}

export function storageParameterStr<
  TStorageParameters extends Nullable<StorageParameters>,
  TKey extends keyof TStorageParameters,
>(storageParameters: TStorageParameters): (key: TKey) => string {
  return (key) => {
    const value =
      storageParameters[key] === true ? '' : ` = ${storageParameters[key]}`;

    // @ts-expect-error: Implicit conversion of a 'symbol' to a 'string' will fail at runtime. Consider wrapping this expression in 'String(...)'. ts(2731)
    return `${key}${value}`;
  };
}
