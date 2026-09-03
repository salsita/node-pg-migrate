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

    return `${String(key)}${value}`;
  };
}
