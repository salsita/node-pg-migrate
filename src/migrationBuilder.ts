/*
 The migration builder is used to actually create a migration from instructions

 A new instance of MigrationBuilder is instantiated and passed to the up or down block
 of each migration when it is being run.

 It makes the methods available via the pgm variable and stores up the sql commands.
 This is what makes it possible to do this without making everything async
 and it makes inference of down migrations possible.
 */

import * as casts from './operations/casts';
import * as domains from './operations/domains';
import * as extensions from './operations/extensions';
import * as functions from './operations/functions';
import type { Operation } from './operations/generalTypes';
import * as grants from './operations/grants';
import * as indexes from './operations/indexes';
import * as mViews from './operations/materializedViews';
import * as operators from './operations/operators';
import * as policies from './operations/policies';
import * as roles from './operations/roles';
import * as schemas from './operations/schemas';
import * as sequences from './operations/sequences';
import * as sql from './operations/sql';
import type { ColumnDefinitions } from './operations/tables';
import * as tables from './operations/tables';
import * as triggers from './operations/triggers';
import * as types from './operations/types';
import * as views from './operations/views';
import type { DB, Logger, MigrationBuilder, MigrationOptions } from './types';
import { createSchemalize, PgLiteral } from './utils';

export default class MigrationBuilderImpl implements MigrationBuilder {
  public readonly createExtension: (
    ...args: Parameters<extensions.CreateExtension>
  ) => void;

  public readonly dropExtension: (
    ...args: Parameters<extensions.DropExtension>
  ) => void;

  public readonly addExtension: (
    ...args: Parameters<extensions.CreateExtension>
  ) => void;

  public readonly createTable: (
    ...args: Parameters<tables.CreateTable>
  ) => void;

  public readonly dropTable: (...args: Parameters<tables.DropTable>) => void;

  public readonly renameTable: (
    ...args: Parameters<tables.RenameTable>
  ) => void;

  public readonly alterTable: (...args: Parameters<tables.AlterTable>) => void;

  public readonly addColumns: (...args: Parameters<tables.AddColumns>) => void;

  public readonly dropColumns: (
    ...args: Parameters<tables.DropColumns>
  ) => void;

  public readonly renameColumn: (
    ...args: Parameters<tables.RenameColumn>
  ) => void;

  public readonly alterColumn: (
    ...args: Parameters<tables.AlterColumn>
  ) => void;

  public readonly addColumn: (...args: Parameters<tables.AddColumns>) => void;

  public readonly dropColumn: (...args: Parameters<tables.DropColumns>) => void;

  public readonly addConstraint: (
    ...args: Parameters<tables.CreateConstraint>
  ) => void;

  public readonly dropConstraint: (
    ...args: Parameters<tables.DropConstraint>
  ) => void;

  public readonly renameConstraint: (
    ...args: Parameters<tables.RenameConstraint>
  ) => void;

  public readonly createConstraint: (
    ...args: Parameters<tables.CreateConstraint>
  ) => void;

  public readonly createType: (...args: Parameters<types.CreateType>) => void;

  public readonly dropType: (...args: Parameters<types.DropType>) => void;

  public readonly addType: (...args: Parameters<types.CreateType>) => void;

  public readonly renameType: (...args: Parameters<types.RenameType>) => void;

  public readonly renameTypeAttribute: (
    ...args: Parameters<types.RenameTypeAttribute>
  ) => void;

  public readonly renameTypeValue: (
    ...args: Parameters<types.RenameTypeValue>
  ) => void;

  public readonly addTypeAttribute: (
    ...args: Parameters<types.AddTypeAttribute>
  ) => void;

  public readonly dropTypeAttribute: (
    ...args: Parameters<types.DropTypeAttribute>
  ) => void;

  public readonly setTypeAttribute: (
    ...args: Parameters<types.SetTypeAttribute>
  ) => void;

  public readonly addTypeValue: (
    ...args: Parameters<types.AddTypeValue>
  ) => void;

  public readonly createIndex: (
    ...args: Parameters<indexes.CreateIndex>
  ) => void;

  public readonly dropIndex: (...args: Parameters<indexes.DropIndex>) => void;

  public readonly addIndex: (...args: Parameters<indexes.CreateIndex>) => void;

  public readonly createRole: (...args: Parameters<roles.CreateRole>) => void;

  public readonly dropRole: (...args: Parameters<roles.DropRole>) => void;

  public readonly alterRole: (...args: Parameters<roles.AlterRole>) => void;

  public readonly renameRole: (...args: Parameters<roles.RenameRole>) => void;

  public readonly createFunction: (
    ...args: Parameters<functions.CreateFunction>
  ) => void;

  public readonly dropFunction: (
    ...args: Parameters<functions.DropFunction>
  ) => void;

  public readonly renameFunction: (
    ...args: Parameters<functions.RenameFunction>
  ) => void;

  public readonly createTrigger: (
    ...args: Parameters<triggers.CreateTrigger>
  ) => void;

  public readonly dropTrigger: (
    ...args: Parameters<triggers.DropTrigger>
  ) => void;

  public readonly renameTrigger: (
    ...args: Parameters<triggers.RenameTrigger>
  ) => void;

  public readonly createSchema: (
    ...args: Parameters<schemas.CreateSchema>
  ) => void;

  public readonly dropSchema: (...args: Parameters<schemas.DropSchema>) => void;

  public readonly renameSchema: (
    ...args: Parameters<schemas.RenameSchema>
  ) => void;

  public readonly createDomain: (
    ...args: Parameters<domains.CreateDomain>
  ) => void;

  public readonly dropDomain: (...args: Parameters<domains.DropDomain>) => void;

  public readonly alterDomain: (
    ...args: Parameters<domains.AlterDomain>
  ) => void;

  public readonly renameDomain: (
    ...args: Parameters<domains.RenameDomain>
  ) => void;

  public readonly createSequence: (
    ...args: Parameters<sequences.CreateSequence>
  ) => void;

  public readonly dropSequence: (
    ...args: Parameters<sequences.DropSequence>
  ) => void;

  public readonly alterSequence: (
    ...args: Parameters<sequences.AlterSequence>
  ) => void;

  public readonly renameSequence: (
    ...args: Parameters<sequences.RenameSequence>
  ) => void;

  public readonly createOperator: (
    ...args: Parameters<operators.CreateOperator>
  ) => void;

  public readonly dropOperator: (
    ...args: Parameters<operators.DropOperator>
  ) => void;

  public readonly createOperatorClass: (
    ...args: Parameters<operators.CreateOperatorClass>
  ) => void;

  public readonly dropOperatorClass: (
    ...args: Parameters<operators.DropOperatorClass>
  ) => void;

  public readonly renameOperatorClass: (
    ...args: Parameters<operators.RenameOperatorClass>
  ) => void;

  public readonly createOperatorFamily: (
    ...args: Parameters<operators.CreateOperatorFamily>
  ) => void;

  public readonly dropOperatorFamily: (
    ...args: Parameters<operators.DropOperatorFamily>
  ) => void;

  public readonly renameOperatorFamily: (
    ...args: Parameters<operators.RenameOperatorFamily>
  ) => void;

  public readonly addToOperatorFamily: (
    ...args: Parameters<operators.AddToOperatorFamily>
  ) => void;

  public readonly removeFromOperatorFamily: (
    ...args: Parameters<operators.RemoveFromOperatorFamily>
  ) => void;

  public readonly createPolicy: (
    ...args: Parameters<policies.CreatePolicy>
  ) => void;

  public readonly dropPolicy: (
    ...args: Parameters<policies.DropPolicy>
  ) => void;

  public readonly alterPolicy: (
    ...args: Parameters<policies.AlterPolicy>
  ) => void;

  public readonly renamePolicy: (
    ...args: Parameters<policies.RenamePolicy>
  ) => void;

  public readonly createView: (...args: Parameters<views.CreateView>) => void;

  public readonly dropView: (...args: Parameters<views.DropView>) => void;

  public readonly alterView: (...args: Parameters<views.AlterView>) => void;

  public readonly alterViewColumn: (
    ...args: Parameters<views.AlterViewColumn>
  ) => void;

  public readonly renameView: (...args: Parameters<views.RenameView>) => void;

  public readonly createMaterializedView: (
    ...args: Parameters<mViews.CreateMaterializedView>
  ) => void;

  public readonly dropMaterializedView: (
    ...args: Parameters<mViews.DropMaterializedView>
  ) => void;

  public readonly alterMaterializedView: (
    ...args: Parameters<mViews.AlterMaterializedView>
  ) => void;

  public readonly renameMaterializedView: (
    ...args: Parameters<mViews.RenameMaterializedView>
  ) => void;

  public readonly renameMaterializedViewColumn: (
    ...args: Parameters<mViews.RenameMaterializedViewColumn>
  ) => void;

  public readonly refreshMaterializedView: (
    ...args: Parameters<mViews.RefreshMaterializedView>
  ) => void;

  public readonly grantRoles: (...args: Parameters<grants.GrantRoles>) => void;

  public readonly revokeRoles: (
    ...args: Parameters<grants.RevokeRoles>
  ) => void;

  public readonly grantOnSchemas: (
    ...args: Parameters<grants.GrantOnSchemas>
  ) => void;

  public readonly revokeOnSchemas: (
    ...args: Parameters<grants.RevokeOnSchemas>
  ) => void;

  public readonly grantOnTables: (
    ...args: Parameters<grants.GrantOnTables>
  ) => void;

  public readonly revokeOnTables: (
    ...args: Parameters<grants.RevokeOnTables>
  ) => void;

  public readonly createCast: (...args: Parameters<casts.CreateCast>) => void;

  public readonly dropCast: (...args: Parameters<casts.DropCast>) => void;

  public readonly sql: (...args: Parameters<sql.Sql>) => void;

  public readonly func: (sql: string) => PgLiteral;

  public readonly db: DB;

  private _steps: string[];

  private _REVERSE_MODE: boolean;

  private _useTransaction: boolean;

  constructor(
    db: DB,
    typeShorthands: ColumnDefinitions | undefined,
    shouldDecamelize: boolean,
    logger: Logger
  ) {
    this._steps = [];
    this._REVERSE_MODE = false;
    // By default, all migrations are wrapped in a transaction
    this._useTransaction = true;

    // This function wraps each operation within a function that either calls
    // the operation or its reverse, and appends the result
    // (array of sql statements) to the steps array
    const wrap =
      <TOperation extends Operation>(operation: TOperation) =>
      (...args: Parameters<TOperation>) => {
        if (this._REVERSE_MODE) {
          if (typeof operation.reverse !== 'function') {
            const name = `pgm.${operation.name}()`;
            throw new Error(
              `Impossible to automatically infer down migration for "${name}"`
            );
          }

          // eslint-disable-next-line unicorn/prefer-spread
          this._steps = this._steps.concat(operation.reverse(...args));
        } else {
          // eslint-disable-next-line unicorn/prefer-spread
          this._steps = this._steps.concat(operation(...args));
        }
      };

    const options: MigrationOptions = {
      typeShorthands,
      schemalize: createSchemalize({ shouldDecamelize, shouldQuote: false }),
      literal: createSchemalize({ shouldDecamelize, shouldQuote: true }),
      logger,
    };

    // Defines the methods that are accessible via pgm in each migrations there
    // are some convenience aliases to make usage easier
    this.createExtension = wrap(extensions.createExtension(options));
    this.dropExtension = wrap(extensions.dropExtension(options));
    this.addExtension = this.createExtension;

    this.createTable = wrap(tables.createTable(options));
    this.dropTable = wrap(tables.dropTable(options));
    this.renameTable = wrap(tables.renameTable(options));
    this.alterTable = wrap(tables.alterTable(options));

    this.addColumns = wrap(tables.addColumns(options));
    this.dropColumns = wrap(tables.dropColumns(options));
    this.renameColumn = wrap(tables.renameColumn(options));
    this.alterColumn = wrap(tables.alterColumn(options));
    this.addColumn = this.addColumns;
    this.dropColumn = this.dropColumns;

    this.addConstraint = wrap(tables.addConstraint(options));
    this.dropConstraint = wrap(tables.dropConstraint(options));
    this.renameConstraint = wrap(tables.renameConstraint(options));
    this.createConstraint = this.addConstraint;

    this.createType = wrap(types.createType(options));
    this.dropType = wrap(types.dropType(options));
    this.addType = this.createType;
    this.renameType = wrap(types.renameType(options));
    this.renameTypeAttribute = wrap(types.renameTypeAttribute(options));
    this.renameTypeValue = wrap(types.renameTypeValue(options));
    this.addTypeAttribute = wrap(types.addTypeAttribute(options));
    this.dropTypeAttribute = wrap(types.dropTypeAttribute(options));
    this.setTypeAttribute = wrap(types.setTypeAttribute(options));
    this.addTypeValue = wrap(types.addTypeValue(options));

    this.createIndex = wrap(indexes.createIndex(options));
    this.dropIndex = wrap(indexes.dropIndex(options));
    this.addIndex = this.createIndex;

    this.createRole = wrap(roles.createRole(options));
    this.dropRole = wrap(roles.dropRole(options));
    this.alterRole = wrap(roles.alterRole(options));
    this.renameRole = wrap(roles.renameRole(options));

    this.createFunction = wrap(functions.createFunction(options));
    this.dropFunction = wrap(functions.dropFunction(options));
    this.renameFunction = wrap(functions.renameFunction(options));

    this.createTrigger = wrap(triggers.createTrigger(options));
    this.dropTrigger = wrap(triggers.dropTrigger(options));
    this.renameTrigger = wrap(triggers.renameTrigger(options));

    this.createSchema = wrap(schemas.createSchema(options));
    this.dropSchema = wrap(schemas.dropSchema(options));
    this.renameSchema = wrap(schemas.renameSchema(options));

    this.createDomain = wrap(domains.createDomain(options));
    this.dropDomain = wrap(domains.dropDomain(options));
    this.alterDomain = wrap(domains.alterDomain(options));
    this.renameDomain = wrap(domains.renameDomain(options));

    this.createSequence = wrap(sequences.createSequence(options));
    this.dropSequence = wrap(sequences.dropSequence(options));
    this.alterSequence = wrap(sequences.alterSequence(options));
    this.renameSequence = wrap(sequences.renameSequence(options));

    this.createOperator = wrap(operators.createOperator(options));
    this.dropOperator = wrap(operators.dropOperator(options));
    this.createOperatorClass = wrap(operators.createOperatorClass(options));
    this.dropOperatorClass = wrap(operators.dropOperatorClass(options));
    this.renameOperatorClass = wrap(operators.renameOperatorClass(options));
    this.createOperatorFamily = wrap(operators.createOperatorFamily(options));
    this.dropOperatorFamily = wrap(operators.dropOperatorFamily(options));
    this.renameOperatorFamily = wrap(operators.renameOperatorFamily(options));
    this.addToOperatorFamily = wrap(operators.addToOperatorFamily(options));
    this.removeFromOperatorFamily = wrap(
      operators.removeFromOperatorFamily(options)
    );

    this.createPolicy = wrap(policies.createPolicy(options));
    this.dropPolicy = wrap(policies.dropPolicy(options));
    this.alterPolicy = wrap(policies.alterPolicy(options));
    this.renamePolicy = wrap(policies.renamePolicy(options));

    this.createView = wrap(views.createView(options));
    this.dropView = wrap(views.dropView(options));
    this.alterView = wrap(views.alterView(options));
    this.alterViewColumn = wrap(views.alterViewColumn(options));
    this.renameView = wrap(views.renameView(options));

    this.createMaterializedView = wrap(mViews.createMaterializedView(options));
    this.dropMaterializedView = wrap(mViews.dropMaterializedView(options));
    this.alterMaterializedView = wrap(mViews.alterMaterializedView(options));
    this.renameMaterializedView = wrap(mViews.renameMaterializedView(options));
    this.renameMaterializedViewColumn = wrap(
      mViews.renameMaterializedViewColumn(options)
    );
    this.refreshMaterializedView = wrap(
      mViews.refreshMaterializedView(options)
    );

    this.grantRoles = wrap(grants.grantRoles(options));
    this.revokeRoles = wrap(grants.revokeRoles(options));
    this.grantOnSchemas = wrap(grants.grantOnSchemas(options));
    this.revokeOnSchemas = wrap(grants.revokeOnSchemas(options));
    this.grantOnTables = wrap(grants.grantOnTables(options));
    this.revokeOnTables = wrap(grants.revokeOnTables(options));

    this.createCast = wrap(casts.createCast(options));
    this.dropCast = wrap(casts.dropCast(options));

    this.sql = wrap(sql.sql(options));

    // Other utilities which may be useful
    // .func creates a string which will not be escaped
    // common uses are for PG functions, ex: { ... default: pgm.func('NOW()') }
    this.func = PgLiteral.create;

    // Expose DB so we can access database within transaction
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const wrapDB =
      <T extends any[], TResult>(operation: (...args: T) => TResult) =>
      (...args: T) => {
        if (this._REVERSE_MODE) {
          throw new Error('Impossible to automatically infer down migration');
        }

        return operation(...args);
      };

    /* eslint-enable @typescript-eslint/no-explicit-any */
    this.db = {
      query: wrapDB(db.query),
      select: wrapDB(db.select),
    };
  }

  enableReverseMode(): this {
    this._REVERSE_MODE = true;
    return this;
  }

  noTransaction(): this {
    this._useTransaction = false;
    return this;
  }

  isUsingTransaction(): boolean {
    return this._useTransaction;
  }

  getSql(): string {
    return `${this.getSqlSteps().join('\n')}\n`;
  }

  getSqlSteps(): string[] {
    // In reverse mode, we flip the order of the statements
    return this._REVERSE_MODE ? [...this._steps].reverse() : this._steps;
  }
}

export function createMigrationBuilder({
  db,
  typeShorthands,
  shouldDecamelize = true,
  logger = console,
}: {
  db?: DB;
  typeShorthands?: ColumnDefinitions;
  shouldDecamelize?: boolean;
  logger?: Logger;
} = {}): MigrationBuilderImpl {
  return new MigrationBuilderImpl(
    db || {
      select: () => {
        throw new Error('Not implemented');
      },
      query: () => {
        throw new Error('Not implemented');
      },
    },
    typeShorthands,
    shouldDecamelize,
    logger
  );
}
