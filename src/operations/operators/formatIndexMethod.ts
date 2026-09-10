import { isSingleIdentifier } from '../../utils/isSingleIdentifier';

export function formatIndexMethod(
  indexMethod: string,
  operation: string
): string {
  if (!isSingleIdentifier(indexMethod)) {
    throw new Error(
      `${operation} requires indexMethod to be a string containing a single unqualified identifier`
    );
  }
  return ` USING ${indexMethod}`;
}
