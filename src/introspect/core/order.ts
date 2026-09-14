import { BaselineError } from '../../baseline/errors';
import type {
  ModelObject,
  ObjectComment,
  ObjectKind,
  ObjectRef,
  OrderedObject,
  Phase,
  SchemaModel,
  SchemaQualifiedName,
} from '../types';
import { compareText } from './sort';

/**
 * The phase of each kind of step. Among the steps whose dependencies are
 * met, a lower phase goes first.
 */
export const PHASES = {
  /**
   * Saves `check_function_bodies` and turns it off.
   */
  prologue: 0,
  schemas: 1,
  extensions: 2,

  /**
   * Enums, shell types, composite types, domains and range types.
   */
  types: 3,

  /**
   * Collations, with the types.
   */
  collations: 3,
  sequences: 4,
  functions: 5,

  /**
   * Operators, after the functions that implement them.
   */
  operators: 6,

  /**
   * Casts, after the functions that implement them.
   */
  casts: 7,
  aggregates: 8,

  /**
   * Tables; a partition or inheritance child after its parents.
   */
  tables: 9,
  sequenceOwnership: 10,

  /**
   * Primary key, unique, exclusion and CHECK constraints.
   */
  constraints: 11,
  foreignKeys: 12,
  indexes: 13,

  /**
   * Views and materialized views.
   */
  views: 14,
  triggers: 15,

  /**
   * Row-level security and policies.
   */
  rowLevelSecurity: 16,

  /**
   * Rules and extended statistics.
   */
  rulesAndStatistics: 17,
  comments: 18,

  /**
   * Restores `check_function_bodies`.
   */
  epilogue: 99,
} as const satisfies Readonly<Record<string, Phase>>;

/**
 * The phase of the step that creates an object of each kind; foreign keys
 * are the constraints of phase {@link PHASES.foreignKeys}.
 */
const CREATE_PHASES: Readonly<Record<ObjectKind, Phase>> = {
  schema: PHASES.schemas,
  extension: PHASES.extensions,
  enum: PHASES.types,
  shellType: PHASES.types,
  composite: PHASES.types,
  domain: PHASES.types,
  range: PHASES.types,
  collation: PHASES.collations,
  sequence: PHASES.sequences,
  function: PHASES.functions,
  operator: PHASES.operators,
  cast: PHASES.casts,
  aggregate: PHASES.aggregates,
  table: PHASES.tables,
  constraint: PHASES.constraints,
  index: PHASES.indexes,
  view: PHASES.views,
  materializedView: PHASES.views,
  trigger: PHASES.triggers,
  policy: PHASES.rowLevelSecurity,
  rule: PHASES.rulesAndStatistics,
  statistics: PHASES.rulesAndStatistics,
};

/**
 * The phase of the step that creates an object.
 */
function createPhase(object: ModelObject): Phase {
  return object.kind === 'constraint' && object.type === 'foreignKey'
    ? PHASES.foreignKeys
    : CREATE_PHASES[object.kind];
}

/**
 * How an object is named in messages and in `Fallback.identity`, with names
 * as PostgreSQL stores them (no quotes): `schema.name` for objects of a
 * schema (just `name` for a schema), `schema.name(identity arguments)` for
 * functions, operators and aggregates, `name on schema.table` for
 * constraints, triggers, policies and rules, `(source AS target)` for casts.
 *
 * @param object The object.
 * @returns Its identity, e.g. `orders_pkey on public.orders`.
 */
export function objectIdentity(object: ModelObject): string {
  if (object.kind === 'schema') {
    return object.name;
  }

  if (object.kind === 'cast') {
    return `(${object.source} AS ${object.target})`;
  }

  if (
    object.kind === 'function' ||
    object.kind === 'operator' ||
    object.kind === 'aggregate'
  ) {
    return `${object.schema}.${object.name}(${object.identityArguments})`;
  }

  if (
    object.kind === 'constraint' ||
    object.kind === 'trigger' ||
    object.kind === 'policy' ||
    object.kind === 'rule'
  ) {
    return `${object.name} on ${object.table.schema}.${object.table.name}`;
  }

  return `${object.schema}.${object.name}`;
}

/**
 * What the steps are sorted by (see {@link orderObjects}): the phase, the
 * schema and name of the object, the schema and name of its table, its
 * identity arguments, the column or constraint of a comment, the step, the
 * kind and the OID of the object, and what a comment is on.
 */
type SortKey = readonly [
  phase: number,
  schema: string,
  name: string,
  tableSchema: string,
  tableName: string,
  identityArguments: string,
  detail: string,
  step: number,
  kind: string,
  oid: number,
  commentOn: number,
];

const STEP_RANKS = {
  create: 0,
  sequenceOwnership: 1,
  rowLevelSecurity: 2,
  comment: 3,
} as const;

const COMMENT_RANKS: Readonly<Record<ObjectComment['on'], number>> = {
  object: 0,
  column: 1,
  domainConstraint: 2,
  constraintIndex: 3,
};

/**
 * Compares two values of the same field of sort keys: numbers as numbers,
 * strings by UTF-16 code units.
 */
function compareValues(left: string | number, right: string | number): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  if (left === right) {
    return 0;
  }

  return String(left) < String(right) ? -1 : 1;
}

function compareKeys(left: SortKey, right: SortKey): number {
  for (const [index, value] of left.entries()) {
    const order = compareValues(value, right[index]);
    if (order !== 0) {
      return order;
    }
  }

  return 0;
}

/**
 * The schema, name, table and identity arguments of an object, as its sort
 * key has them.
 */
function objectKey(
  object: ModelObject
): [string, string, string, string, string] {
  if (object.kind === 'cast') {
    return [object.source, object.target, '', '', ''];
  }

  const table: SchemaQualifiedName | undefined =
    'table' in object ? object.table : undefined;
  const identityArguments =
    'identityArguments' in object ? object.identityArguments : '';

  return [
    object.schema,
    object.name,
    table?.schema ?? '',
    table?.name ?? '',
    identityArguments,
  ];
}

function sortKey(
  phase: Phase,
  step: keyof typeof STEP_RANKS,
  object: ModelObject,
  detail = '',
  commentOn = 0
): SortKey {
  return [
    phase,
    ...objectKey(object),
    detail,
    STEP_RANKS[step],
    object.kind,
    object.oid,
    commentOn,
  ];
}

/**
 * A comment step to add, with the column or constraint of the comment.
 */
interface CommentStep {
  readonly comment: ObjectComment;
  readonly detail: string;
}

/**
 * The comments on the columns of views and materialized views, and on the
 * attributes of composite types.
 */
function columnComments(model: SchemaModel): CommentStep[] {
  const relations = [...model.views, ...model.materializedViews].flatMap(
    (object) =>
      object.columns.map((column) => ({
        object,
        column: column.name,
        text: column.comment,
      }))
  );
  const attributes = model.composites.flatMap((object) =>
    object.attributes.map((attribute) => ({
      object,
      column: attribute.name,
      text: attribute.comment,
    }))
  );

  return [...relations, ...attributes].flatMap(({ object, column, text }) =>
    text === undefined
      ? []
      : [{ comment: { on: 'column', object, column, text }, detail: column }]
  );
}

/**
 * The comments of a model that are not set with a table, each with its
 * column or constraint.
 */
function commentsOf(model: SchemaModel): CommentStep[] {
  const objects: Array<Extract<ObjectComment, { on: 'object' }>['object']> = [
    ...model.schemas,
    ...model.enums,
    ...model.composites,
    ...model.domains,
    ...model.ranges,
    ...model.collations,
    ...model.sequences,
    ...model.functions,
    ...model.operators,
    ...model.casts,
    ...model.aggregates,
    ...model.constraints,
    ...model.indexes,
    ...model.views,
    ...model.materializedViews,
    ...model.triggers,
    ...model.policies,
    ...model.rules,
    ...model.statistics,
  ];
  const onObjects = objects.flatMap((object): CommentStep[] =>
    object.comment === undefined
      ? []
      : [
          {
            comment: { on: 'object', object, text: object.comment },
            detail: '',
          },
        ]
  );
  const onDomainConstraints = model.domains.flatMap((object) =>
    [
      {
        name: object.notNullConstraintName,
        comment: object.notNullConstraintComment,
      },
      ...object.checks,
    ].flatMap(({ name, comment }): CommentStep[] =>
      name === undefined || comment === undefined
        ? []
        : [
            {
              comment: {
                on: 'domainConstraint',
                object,
                constraint: name,
                text: comment,
              },
              detail: name,
            },
          ]
    )
  );
  const onConstraintIndexes = model.constraints.flatMap(
    (object): CommentStep[] =>
      object.indexComment === undefined
        ? []
        : [
            {
              comment: {
                on: 'constraintIndex',
                object,
                text: object.indexComment,
              },
              detail: '',
            },
          ]
  );

  return [
    ...onObjects,
    ...columnComments(model),
    ...onDomainConstraints,
    ...onConstraintIndexes,
  ];
}

/**
 * A step to order, with what it waits for.
 */
interface StepNode {
  readonly step: OrderedObject;
  readonly key: SortKey;

  /**
   * The object of a `create` step, for messages.
   */
  readonly object?: ModelObject;

  /**
   * The steps that wait for this one.
   */
  readonly dependents: number[];

  /**
   * How many steps this one still waits for.
   */
  waitsFor: number;
}

function refKey(ref: ObjectRef): string {
  return `${ref.kind}:${String(ref.oid)}`;
}

function nameKey(name: SchemaQualifiedName): string {
  return `${name.schema} ${name.name}`;
}

/**
 * The steps of a model and what each waits for.
 */
class StepGraph {
  readonly nodes: StepNode[] = [];

  private readonly creates = new Map<string, number>();

  private readonly relations = new Map<string, number>();

  add(step: OrderedObject, key: SortKey, object?: ModelObject): number {
    const index = this.nodes.length;
    this.nodes.push({
      step,
      key,
      dependents: [],
      waitsFor: 0,
      ...(object === undefined ? {} : { object }),
    });
    if (object !== undefined) {
      this.creates.set(refKey(object), index);
      if (
        object.kind === 'table' ||
        object.kind === 'view' ||
        object.kind === 'materializedView'
      ) {
        this.relations.set(nameKey(object), index);
      }
    }

    return index;
  }

  create(ref: ObjectRef): number | undefined {
    return this.creates.get(refKey(ref));
  }

  relation(name: SchemaQualifiedName | undefined): number | undefined {
    return name === undefined ? undefined : this.relations.get(nameKey(name));
  }

  /**
   * Makes `step` wait for `needed`, when both exist and differ.
   */
  wait(step: number, needed: number | undefined): void {
    if (needed === undefined || step === needed) {
      return;
    }

    this.nodes[needed].dependents.push(step);
    this.nodes[step].waitsFor += 1;
  }

  /**
   * Whether step `left` sorts before step `right`.
   */
  before(left: number, right: number): boolean {
    return compareKeys(this.nodes[left].key, this.nodes[right].key) < 0;
  }
}

/**
 * Adds a step to a binary heap of steps whose first item sorts first.
 */
function pushReady(graph: StepGraph, heap: number[], step: number): void {
  heap.push(step);
  let child = heap.length - 1;
  while (child > 0) {
    const parent = Math.floor((child - 1) / 2);
    if (!graph.before(heap[child], heap[parent])) {
      return;
    }

    [heap[child], heap[parent]] = [heap[parent], heap[child]];
    child = parent;
  }
}

/**
 * Takes the step that sorts first out of a heap of steps (see
 * {@link pushReady}).
 */
function popReady(graph: StepGraph, heap: number[]): number | undefined {
  const top = heap.at(0);
  const last = heap.pop();
  if (last === undefined || heap.length === 0) {
    return top;
  }

  heap[0] = last;
  let parent = 0;
  for (;;) {
    let first = parent;
    for (const child of [2 * parent + 1, 2 * parent + 2]) {
      if (child < heap.length && graph.before(heap[child], heap[first])) {
        first = child;
      }
    }

    if (first === parent) {
      return top;
    }

    [heap[parent], heap[first]] = [heap[first], heap[parent]];
    parent = first;
  }
}

/**
 * The objects of a model, in the order of its arrays.
 */
function objectsOf(model: SchemaModel): ModelObject[] {
  return [
    ...model.schemas,
    ...model.extensions,
    ...model.enums,
    ...model.composites,
    ...model.domains,
    ...model.ranges,
    ...model.collations,
    ...model.sequences,
    ...model.functions,
    ...model.operators,
    ...model.casts,
    ...model.aggregates,
    ...model.tables,
    ...model.constraints,
    ...model.indexes,
    ...model.views,
    ...model.materializedViews,
    ...model.triggers,
    ...model.policies,
    ...model.rules,
    ...model.statistics,
  ];
}

/**
 * The dependencies an object has by its own fields, besides the ones of
 * `model.dependencies`: on its table, a partition's partitioned table, an
 * inheritance child's parents and a foreign key's referenced table.
 */
function implicitDependencies(
  graph: StepGraph,
  index: number,
  object: ModelObject
): void {
  if ('table' in object) {
    graph.wait(index, graph.relation(object.table));
  }

  if (object.kind === 'constraint') {
    graph.wait(index, graph.relation(object.references));
  }

  if (object.kind === 'table') {
    graph.wait(index, graph.relation(object.partitionOf?.parent));
    for (const parent of object.inherits) {
      graph.wait(index, graph.relation(parent));
    }
  }
}

/**
 * The steps of the objects of a model (all but the prologue and the
 * epilogue) and what each waits for.
 */
function buildGraph(model: SchemaModel): StepGraph {
  const graph = new StepGraph();
  const objects = objectsOf(model);
  const creates = objects.map((object) => {
    const phase = createPhase(object);

    return graph.add(
      { step: 'create', phase, object },
      sortKey(phase, 'create', object),
      object
    );
  });
  for (const [position, object] of objects.entries()) {
    implicitDependencies(graph, creates[position], object);
  }

  for (const { from, to } of model.dependencies) {
    const step = graph.create(from);
    if (step !== undefined) {
      graph.wait(step, graph.create(to));
    }
  }

  for (const sequence of model.sequences) {
    if (sequence.ownedBy !== undefined) {
      const owner = graph.add(
        {
          step: 'sequenceOwnership',
          phase: PHASES.sequenceOwnership,
          object: sequence,
        },
        sortKey(PHASES.sequenceOwnership, 'sequenceOwnership', sequence)
      );
      graph.wait(owner, graph.create(sequence));
      graph.wait(owner, graph.relation(sequence.ownedBy.table));
    }
  }

  for (const table of model.tables) {
    if (table.rowLevelSecurity || table.forceRowLevelSecurity) {
      const security = graph.add(
        {
          step: 'rowLevelSecurity',
          phase: PHASES.rowLevelSecurity,
          object: table,
        },
        sortKey(PHASES.rowLevelSecurity, 'rowLevelSecurity', table)
      );
      graph.wait(security, graph.create(table));
    }
  }

  for (const { comment, detail } of commentsOf(model)) {
    const step = graph.add(
      { step: 'comment', phase: PHASES.comments, object: comment },
      sortKey(
        PHASES.comments,
        'comment',
        comment.object,
        detail,
        COMMENT_RANKS[comment.on]
      )
    );
    graph.wait(step, graph.create(comment.object));
  }

  return graph;
}

/**
 * Takes the steps of a strongly connected component off the stack of
 * Tarjan's algorithm, down to its root.
 */
function popComponent(
  stack: number[],
  onStack: boolean[],
  root: number
): number[] {
  const component: number[] = [];
  for (let member = stack.pop(); member !== undefined; member = stack.pop()) {
    onStack[member] = false;
    component.push(member);
    if (member === root) {
      break;
    }
  }

  return component;
}

/**
 * The strongly connected components of the steps in `members`, following
 * only the edges between them (Tarjan's algorithm, without recursion).
 */
function components(
  nodes: ReadonlyArray<StepNode>,
  members: ReadonlySet<number>
): number[][] {
  const order: number[] = Array.from({ length: nodes.length }, () => -1);
  const low: number[] = Array.from({ length: nodes.length }, () => -1);
  const onStack: boolean[] = Array.from({ length: nodes.length }, () => false);
  const stack: number[] = [];
  const found: number[][] = [];
  const frames: Array<{ node: number; edges: number[]; next: number }> = [];
  let visited = 0;
  const enter = (node: number): void => {
    order[node] = visited;
    low[node] = visited;
    visited += 1;
    stack.push(node);
    onStack[node] = true;
    frames.push({
      node,
      edges: nodes[node].dependents.filter((target) => members.has(target)),
      next: 0,
    });
  };
  const leave = (node: number): void => {
    frames.pop();
    const parent = frames.at(-1);
    if (parent !== undefined) {
      low[parent.node] = Math.min(low[parent.node], low[node]);
    }

    if (low[node] === order[node]) {
      found.push(popComponent(stack, onStack, node));
    }
  };

  for (const start of members) {
    if (order[start] === -1) {
      enter(start);
    }

    for (
      let frame = frames.at(-1);
      frame !== undefined;
      frame = frames.at(-1)
    ) {
      const target = frame.edges.at(frame.next);
      frame.next += 1;
      if (target === undefined) {
        leave(frame.node);
      } else if (order[target] === -1) {
        enter(target);
      } else if (onStack[target]) {
        low[frame.node] = Math.min(low[frame.node], order[target]);
      }
    }
  }

  return found;
}

function describe(object: ModelObject): string {
  const kind =
    object.kind === 'materializedView' ? 'materialized view' : object.kind;

  return `${kind} ${objectIdentity(object)}`;
}

/**
 * The error for the steps that wait for each other: it names the objects
 * of every cycle among them (not the ones that only wait for a cycle).
 */
function cycleError(
  graph: StepGraph,
  waiting: ReadonlySet<number>
): BaselineError {
  const { nodes } = graph;
  const cycles = components(nodes, waiting)
    .filter((component) => component.length > 1)
    .map((component) =>
      component
        .toSorted((left, right) =>
          compareKeys(nodes[left].key, nodes[right].key)
        )
        .flatMap((node) => {
          const { object } = nodes[node];

          return object === undefined ? [] : [describe(object)];
        })
        .join(', ')
    )
    .toSorted(compareText);

  return new BaselineError(
    'UNSUPPORTED_OBJECTS',
    `These objects depend on each other, so no migration can create them one after the other: ${cycles.join('; ')}. Use --format sql for this database.`
  );
}

/**
 * Puts the steps of a migration in an order that PostgreSQL accepts: a
 * topological sort over every step using `model.dependencies`, where among
 * the steps whose dependencies are met the first one goes first by, in
 * turn:
 *
 * 1. `phase` (see {@link PHASES});
 * 2. `schema`, then `name` of the object (of the sequence, table or
 *    commented object for the `sequenceOwnership`, `rowLevelSecurity` and
 *    `comment` steps); a cast has neither, so casts are compared by
 *    `source`, then `target`;
 * 3. the schema, then the name of the object's table, for objects of a table;
 * 4. `identityArguments`, for functions, operators and aggregates;
 * 5. the column or constraint of a comment (`''` for a comment on the object
 *    itself);
 * 6. the step (`create`, `sequenceOwnership`, `rowLevelSecurity`, `comment`),
 *    then the object's `kind`, then its `oid`.
 *
 * Strings are compared by UTF-16 code units (`<`), not by locale. (The one
 * tie left, a comment on a constraint and the comment on its index, puts the
 * comment on the constraint first.)
 *
 * The steps are: the `prologue` (first) and the `epilogue` (last); a
 * `create` step per object of the model; a `sequenceOwnership` step per
 * sequence with `ownedBy`, after the sequence and the owning table; a
 * `rowLevelSecurity` step per table with row-level security enabled or
 * forced, after the table; and a `comment` step, after the object it is on,
 * per comment that is not set with a table: comments on objects other than
 * tables and extensions, on the columns of views, materialized views and
 * composite types, on domain constraints, and on the indexes of
 * constraints. Comments on tables and on their columns are set with the
 * table.
 *
 * Besides `model.dependencies`, an object of a table (constraint, index,
 * trigger, policy, rule, statistics) waits for its table, view or
 * materialized view, a foreign key for the table it references, a partition
 * for its partitioned table and an inheritance child for its parents, when
 * they are in the model.
 *
 * Throws a `BaselineError` with code `UNSUPPORTED_OBJECTS` naming the
 * objects of a dependency cycle, when there is one.
 *
 * @param model The schema.
 * @returns The steps, in order.
 */
export function orderObjects(model: SchemaModel): ReadonlyArray<OrderedObject> {
  const graph = buildGraph(model);
  const { nodes } = graph;
  const ready: number[] = [];
  for (const [index, node] of nodes.entries()) {
    if (node.waitsFor === 0) {
      pushReady(graph, ready, index);
    }
  }

  const steps: OrderedObject[] = [{ step: 'prologue', phase: PHASES.prologue }];
  for (
    let index = popReady(graph, ready);
    index !== undefined;
    index = popReady(graph, ready)
  ) {
    steps.push(nodes[index].step);
    for (const dependent of nodes[index].dependents) {
      nodes[dependent].waitsFor -= 1;
      if (nodes[dependent].waitsFor === 0) {
        pushReady(graph, ready, dependent);
      }
    }
  }

  if (steps.length <= nodes.length) {
    const waiting = new Set<number>();
    for (const [index, node] of nodes.entries()) {
      if (node.waitsFor > 0) {
        waiting.add(index);
      }
    }

    throw cycleError(graph, waiting);
  }

  steps.push({ step: 'epilogue', phase: PHASES.epilogue });

  return steps;
}
