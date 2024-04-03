import type { FunctionParamType } from '../operations/functionsTypes';
import type { Type } from '../operations/generalTypes';
import type {
  ColumnDefinition,
  ColumnDefinitions,
} from '../operations/tablesTypes';

const TYPE_ADAPTERS = Object.freeze({
  int: 'integer',
  string: 'text',
  float: 'real',
  double: 'double precision',
  datetime: 'timestamp',
  bool: 'boolean',
});

const defaultTypeShorthands: ColumnDefinitions = {
  id: { type: 'serial', primaryKey: true }, // convenience type for serial primary keys
};

// some convenience adapters -- see above
export function applyTypeAdapters(type: string): string {
  return type in TYPE_ADAPTERS
    ? TYPE_ADAPTERS[type as keyof typeof TYPE_ADAPTERS]
    : type;
}

function toType(type: string | ColumnDefinition): ColumnDefinition {
  return typeof type === 'string' ? { type } : type;
}

function removeType<TColumnDefinition extends ColumnDefinition>({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type,
  ...rest
}: TColumnDefinition): Omit<TColumnDefinition, 'type'> {
  return rest;
}

export function applyType(
  type: Type,
  extendingTypeShorthands: ColumnDefinitions = {}
): ColumnDefinition & FunctionParamType {
  const typeShorthands: ColumnDefinitions = {
    ...defaultTypeShorthands,
    ...extendingTypeShorthands,
  };

  const options = toType(type);

  let ext: ColumnDefinition | null = null;
  const types: string[] = [options.type];

  while (typeShorthands[types[types.length - 1]]) {
    ext = {
      ...toType(typeShorthands[types[types.length - 1]]),
      ...(ext === null ? {} : removeType(ext)),
    };

    if (types.includes(ext.type)) {
      throw new Error(
        `Shorthands contain cyclic dependency: ${types.join(', ')}, ${ext.type}`
      );
    } else {
      types.push(ext.type);
    }
  }

  return {
    ...ext,
    ...options,
    type: applyTypeAdapters(ext?.type ?? options.type),
  };
}
