import type {
  Dependency,
  DependencyRow,
  ObjectKind,
  ObjectRef,
} from '../types';
import { oidKey, sortByKey } from './sort';

/**
 * The catalog that holds the objects of each kind: the `classid` /
 * `refclassid` of their `pg_depend` rows.
 */
const CATALOGS: Readonly<Record<ObjectKind, string>> = {
  schema: 'pg_namespace',
  extension: 'pg_extension',
  enum: 'pg_type',
  shellType: 'pg_type',
  composite: 'pg_type',
  domain: 'pg_type',
  range: 'pg_type',
  collation: 'pg_collation',
  sequence: 'pg_class',
  function: 'pg_proc',
  operator: 'pg_operator',
  cast: 'pg_cast',
  aggregate: 'pg_proc',
  table: 'pg_class',
  constraint: 'pg_constraint',
  index: 'pg_class',
  view: 'pg_class',
  materializedView: 'pg_class',
  trigger: 'pg_trigger',
  policy: 'pg_policy',
  rule: 'pg_rewrite',
  statistics: 'pg_statistic_ext',
};

/**
 * A reference to an object: only its kind and OID.
 *
 * @param object An object of the model.
 * @returns A new `ObjectRef`.
 */
export function refOf(object: ObjectRef): ObjectRef {
  return { kind: object.kind, oid: object.oid };
}

/**
 * The dependencies of `pg_depend` rows between objects of the model.
 *
 * A sequence's `a` dependency on a column is its owner, not something it
 * needs (see `Sequence.ownedBy`), so it is left out.
 *
 * @param objects Every object of the model.
 * @param rows The rows of the `dependencies` query.
 * @returns The dependencies whose both ends are in `objects`, in the order
 * of `rows`.
 */
export function catalogDependencies(
  objects: ReadonlyArray<ObjectRef>,
  rows: ReadonlyArray<DependencyRow>
): Dependency[] {
  const byCatalogOid = new Map<string, ObjectRef>();
  for (const object of objects) {
    byCatalogOid.set(`${CATALOGS[object.kind]}:${object.oid}`, refOf(object));
  }

  const dependencies: Dependency[] = [];
  for (const row of rows) {
    const from = byCatalogOid.get(`${row.classid}:${row.objid}`);
    const to = byCatalogOid.get(`${row.refclassid}:${row.refobjid}`);
    if (
      from !== undefined &&
      to !== undefined &&
      !(from.kind === 'sequence' && row.deptype === 'a')
    ) {
      dependencies.push({ from, to });
    }
  }

  return dependencies;
}

/**
 * The key of a dependency for sorting and finding duplicates.
 *
 * @param dependency The dependency.
 * @returns `from.kind`, `from.oid`, `to.kind` and `to.oid`, OIDs padded so
 * that they compare as numbers.
 */
function dependencyKey(dependency: Dependency): string[] {
  return [
    dependency.from.kind,
    oidKey(dependency.from.oid),
    dependency.to.kind,
    oidKey(dependency.to.oid),
  ];
}

/**
 * Removes self-dependencies and duplicates, and sorts the dependencies as
 * `SchemaModel.dependencies` says.
 *
 * @param dependencies The dependencies, in any order.
 * @returns The dependencies, sorted.
 */
export function finishDependencies(
  dependencies: ReadonlyArray<Dependency>
): Dependency[] {
  const unique = new Map<string, Dependency>();
  for (const dependency of dependencies) {
    const { from, to } = dependency;
    if (from.kind !== to.kind || from.oid !== to.oid) {
      unique.set(dependencyKey(dependency).join(':'), dependency);
    }
  }

  return sortByKey([...unique.values()], dependencyKey);
}
