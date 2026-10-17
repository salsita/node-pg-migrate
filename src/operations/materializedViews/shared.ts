import { formatOption, quoteOptionName } from '../../utils';
import type { Nullable } from '../generalTypes';

export type StorageParameters = { [key: string]: boolean | number };

export function dataClause(data?: boolean): string {
  return data === undefined ? '' : ` WITH${data ? '' : ' NO'} DATA`;
}

export function storageParameterStr<
  TStorageParameters extends Nullable<StorageParameters>,
>(
  storageParameters: TStorageParameters
): (key: keyof TStorageParameters) => string {
  return (key) =>
    formatOption(quoteOptionName(String(key)), storageParameters[key]);
}
