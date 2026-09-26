import type {
  Constraint,
  Dependency,
  ModelObject,
  SchemaModel,
  Table,
} from '../../src/introspect/types';
import {
  defaultSequenceOptions,
  dependsOn,
  makeColumn,
  makeConstraint,
  makeFunction,
  makeIndex,
  makeTable,
  makeTrigger,
  makeView,
  modelOf,
} from '../introspect/objects';

/**
 * A model like the stress schema of the SQL output: for every table
 * `public.t_<n>`, an identity primary key, a unique column, a foreign key to
 * the previous table, an index and a comment; every 10th table also has a
 * view, a trigger function and a trigger. Its dependencies are the ones
 * `rowsToModel()` would find.
 *
 * It creates `tables` tables, `tables` indexes, `2 * tables` index-backed
 * constraints, `tables` identity sequences and `tables / 10` views.
 */
export function generatedModel(tables: number): SchemaModel {
  const objects: ModelObject[] = [];
  const dependencies: Dependency[] = [];
  let previous: { table: Table; key: Constraint } | undefined;
  for (let n = 1; n <= tables; n += 1) {
    const name = `t_${String(n).padStart(5, '0')}`;
    const table = makeTable('public', name, {
      comment: `Table number ${n}`,
      columns: [
        makeColumn('id', 'bigint', {
          notNull: true,
          identity: {
            generation: 'ALWAYS',
            sequence: { schema: 'public', name: `${name}_id_seq` },
            options: defaultSequenceOptions('bigint'),
          },
        }),
        makeColumn('parent_id', 'bigint'),
        makeColumn('name', 'text', { notNull: true }),
        makeColumn('email', 'text'),
        makeColumn('status', 'text', {
          notNull: true,
          default: "'active'::text",
        }),
        makeColumn('created_at', 'timestamp with time zone', {
          notNull: true,
          default: 'now()',
        }),
      ],
    });
    const key = makeConstraint(
      table,
      `${name}_pkey`,
      'primaryKey',
      'PRIMARY KEY (id)'
    );
    const unique = makeConstraint(
      table,
      `${name}_email_key`,
      'unique',
      'UNIQUE (email)'
    );
    const index = makeIndex(table, `${name}_name_idx`, {
      keys: [{ column: 'name', descending: false, nullsFirst: false }],
    });
    objects.push(table, key, unique, index);
    dependencies.push(
      dependsOn(key, table),
      dependsOn(unique, table),
      dependsOn(index, table)
    );
    if (previous !== undefined) {
      const foreignKey = makeConstraint(
        table,
        `${name}_parent_id_fkey`,
        'foreignKey',
        `FOREIGN KEY (parent_id) REFERENCES public.${previous.table.name}(id)`,
        { references: { schema: 'public', name: previous.table.name } }
      );
      objects.push(foreignKey);
      dependencies.push(
        dependsOn(foreignKey, table),
        dependsOn(foreignKey, previous.table),
        dependsOn(foreignKey, previous.key)
      );
    }

    if (n % 10 === 0) {
      const view = makeView(
        'public',
        `${name}_active`,
        ` SELECT id,\n    name\n   FROM public.${name}\n  WHERE (status = 'active'::text)`
      );
      const fn = makeFunction('public', `${name}_touch`, {
        returns: 'trigger',
        language: 'plpgsql',
        body: '\nBEGIN\n  RETURN NEW;\nEND;\n',
      });
      const trigger = makeTrigger(table, `${name}_touch`, {
        timing: 'BEFORE',
        events: ['UPDATE'],
        function: { schema: 'public', name: fn.name },
      });
      objects.push(view, fn, trigger);
      dependencies.push(
        dependsOn(view, table),
        dependsOn(trigger, table),
        dependsOn(trigger, fn)
      );
    }

    previous = { table, key };
  }

  return modelOf(objects, dependencies);
}
