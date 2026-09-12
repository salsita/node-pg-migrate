import type { Aggregate } from '../../introspect/types';
import { qualifiedName, quoteLiteral } from '../sql';
import type { EmitContext, Emitted } from '../types';
import { emitFallback } from './fallback';

/**
 * The settings of the moving-aggregate mode, or none.
 */
function movingSettings(aggregate: Aggregate): string[] {
  const { moving } = aggregate;
  if (moving === undefined) {
    return [];
  }

  const settings = [
    `MSFUNC = ${moving.stateFunction}`,
    `MINVFUNC = ${moving.inverseFunction}`,
    `MSTYPE = ${moving.stateType}`,
  ];
  if (moving.stateSpace !== undefined) {
    settings.push(`MSSPACE = ${String(moving.stateSpace)}`);
  }

  if (moving.finalFunction !== undefined) {
    settings.push(`MFINALFUNC = ${moving.finalFunction}`);
  }

  if (moving.finalFunctionExtra) {
    settings.push('MFINALFUNC_EXTRA');
  }

  if (moving.finalFunctionModify !== 'READ_ONLY') {
    settings.push(`MFINALFUNC_MODIFY = ${moving.finalFunctionModify}`);
  }

  if (moving.initialCondition !== undefined) {
    settings.push(`MINITCOND = ${quoteLiteral(moving.initialCondition)}`);
  }

  return settings;
}

/**
 * Always a fallback, reason `'aggregate'`: `CREATE AGGREGATE name(args) (…)`
 * built from the model (`pg_get_functiondef()` cannot write aggregates).
 *
 * The arguments are the `identityArguments` (`*` when there are none), so
 * that argument names and `VARIADIC` are kept; the settings are the ones
 * pg_dump writes, in its order, each only when it is not the default.
 *
 * @param aggregate The aggregate.
 * @param _ctx The migration context.
 */
export function emitAggregate(
  aggregate: Aggregate,
  _ctx: EmitContext
): Emitted {
  const settings = [
    `SFUNC = ${aggregate.stateFunction}`,
    `STYPE = ${aggregate.stateType}`,
  ];
  if (aggregate.stateSpace !== undefined) {
    settings.push(`SSPACE = ${String(aggregate.stateSpace)}`);
  }

  if (aggregate.finalFunction !== undefined) {
    settings.push(`FINALFUNC = ${aggregate.finalFunction}`);
  }

  if (aggregate.finalFunctionExtra) {
    settings.push('FINALFUNC_EXTRA');
  }

  if (aggregate.finalFunctionModify !== 'READ_ONLY') {
    settings.push(`FINALFUNC_MODIFY = ${aggregate.finalFunctionModify}`);
  }

  if (aggregate.combineFunction !== undefined) {
    settings.push(`COMBINEFUNC = ${aggregate.combineFunction}`);
  }

  if (aggregate.serialFunction !== undefined) {
    settings.push(`SERIALFUNC = ${aggregate.serialFunction}`);
  }

  if (aggregate.deserialFunction !== undefined) {
    settings.push(`DESERIALFUNC = ${aggregate.deserialFunction}`);
  }

  if (aggregate.initialCondition !== undefined) {
    settings.push(`INITCOND = ${quoteLiteral(aggregate.initialCondition)}`);
  }

  settings.push(...movingSettings(aggregate));
  if (aggregate.sortOperator !== undefined) {
    settings.push(`SORTOP = ${aggregate.sortOperator}`);
  }

  if (aggregate.parallel !== 'UNSAFE') {
    settings.push(`PARALLEL = ${aggregate.parallel}`);
  }

  const args =
    aggregate.identityArguments === '' ? '*' : aggregate.identityArguments;

  return emitFallback(
    `CREATE AGGREGATE ${qualifiedName(aggregate)}(${args}) (${settings.join(', ')});`,
    'aggregate'
  );
}
