import type { DefaultValue, MigrationBuilder } from '../src';

interface Stats {
  name: string;
  attempts: number;
  createdAt: Date;
}

// Compile-only checks run by ts-check; this function is never executed.
export function checkDefaultValueTypes(
  pgm: MigrationBuilder,
  stats: Stats
): void {
  const value: DefaultValue = stats;
  pgm.createTable('records', { document: { type: 'jsonb', default: value } });
  pgm.addColumns('records', { document: { type: 'jsonb', default: stats } });
  pgm.alterColumn('records', 'document', { default: stats });
  pgm.createDomain('document', 'jsonb', { default: stats });
  pgm.alterDomain('document', { default: stats });
  pgm.createFunction(
    'document',
    [{ name: 'value', type: 'jsonb', default: stats }],
    { language: 'sql', returns: 'jsonb' },
    'SELECT value'
  );
  pgm.alterViewColumn('records_view', 'document', { default: stats });

  pgm.sql('SELECT * FROM {table}', {
    table: { schema: 'app', name: 'records' },
  });
  // @ts-expect-error: JSON data must not widen SQL argument types.
  pgm.sql('SELECT {document}', { document: { attempts: 0 } });
  // @ts-expect-error: A JSON object literal is not an identifier definition.
  pgm.sql('SELECT {document}', { document: { name: 'Alice', age: 3 } });
  // @ts-expect-error: Role passwords do not accept JSON objects.
  pgm.createRole('reader', { password: { attempts: 0 } });
  // @ts-expect-error: Role validity does not accept JSON objects.
  pgm.createRole('reader', { valid: { attempts: 0 } });
  // @ts-expect-error: Function definitions do not accept JSON objects.
  pgm.createFunction('f', [], { language: 'sql' }, { attempts: 0 });
  pgm.createTrigger(
    't',
    'trigger',
    { operation: 'INSERT', language: 'sql' },
    // @ts-expect-error: Trigger definitions do not accept JSON objects.
    { attempts: 0 }
  );
  // @ts-expect-error: Trigger arguments do not accept JSON objects.
  pgm.createTrigger('t', 'trigger', {
    operation: 'INSERT',
    functionParams: [{ attempts: 0 }],
  });
  // @ts-expect-error: Enum values do not accept JSON objects.
  pgm.createType('status', [{ attempts: 0 }]);
}
