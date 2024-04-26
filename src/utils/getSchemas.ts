import { toArray } from './toArray';

export function getSchemas(schema?: string | ReadonlyArray<string>): string[] {
  const schemas = toArray(schema).filter(
    (s): s is string => typeof s === 'string' && s.length > 0
  );

  return schemas.length > 0 ? schemas : ['public'];
}
