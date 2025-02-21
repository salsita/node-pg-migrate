import type { MigrationOptions } from '../../migrationOptions';
import type { Name, Reversible } from '../generalTypes';
import type { DropOperatorFamilyOptions } from './dropOperatorFamily';
import { dropOperatorFamily } from './dropOperatorFamily';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CreateOperatorFamilyOptions {}

export type CreateOperatorFamilyFn = (
  operatorFamilyName: Name,
  indexMethod: Name,
  operatorFamilyOptions?: CreateOperatorFamilyOptions &
    DropOperatorFamilyOptions
) => string;

export type CreateOperatorFamily = Reversible<CreateOperatorFamilyFn>;

export function createOperatorFamily(
  mOptions: MigrationOptions
): CreateOperatorFamily {
  const _create: CreateOperatorFamily = (operatorFamilyName, indexMethod) => {
    const operatorFamilyNameStr = mOptions.literal(operatorFamilyName);

    return `CREATE OPERATOR FAMILY ${operatorFamilyNameStr} USING ${indexMethod};`;
  };

  _create.reverse = dropOperatorFamily(mOptions);

  return _create;
}
