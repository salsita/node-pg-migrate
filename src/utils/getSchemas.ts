export function getSchemas(schema?: string | string[]): string[] {
  const schemas = (Array.isArray(schema) ? schema : [schema]).filter(
    (s): s is string => typeof s === 'string' && s.length > 0
  );

  return schemas.length > 0 ? schemas : ['public'];
}
