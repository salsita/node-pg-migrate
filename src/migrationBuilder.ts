import type { DB } from './db';
import type { Logger } from './logger';
import type { MigrationOptions } from './migrationOptions';
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
import { createSchemalize, PgLiteral } from './utils';

/*
 * The migration builder is used to actually create a migration from instructions
 *
 * A new instance of MigrationBuilder is instantiated and passed to the up or down block
 * of each migration when it is being run.
 *
 * It makes the methods available via the pgm variable and stores up the sql commands.
 * This is what makes it possible to do this without making everything async
 * and it makes inference of down migrations possible.
 */

export class MigrationBuilder {
  /**
   * Install an extension.
   *
   * @alias addExtension
   *
   * @see https://www.postgresql.org/docs/current/sql-createextension.html
   */
  public readonly createExtension: (
    ...args: Parameters<extensions.CreateExtension>
  ) => void;

  /**
   * Remove an extension.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropextension.html
   */
  public readonly dropExtension: (
    ...args: Parameters<extensions.DropExtension>
  ) => void;

  /**
   * Install an extension.
   *
   * @alias createExtension
   *
   * @see https://www.postgresql.org/docs/current/sql-createextension.html
   */
  public readonly addExtension: (
    ...args: Parameters<extensions.CreateExtension>
  ) => void;

  /**
   * Define a new table.
   *
   * @see https://www.postgresql.org/docs/current/sql-createtable.html
   */
  public readonly createTable: (
    ...args: Parameters<tables.CreateTable>
  ) => void;

  /**
   * Remove a table.
   *
   * @see https://www.postgresql.org/docs/current/sql-droptable.html
   */
  public readonly dropTable: (...args: Parameters<tables.DropTable>) => void;

  /**
   * Rename a table.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */
  public readonly renameTable: (
    ...args: Parameters<tables.RenameTable>
  ) => void;

  /**
   * Change the definition of a table.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */
  public readonly alterTable: (...args: Parameters<tables.AlterTable>) => void;

  /**
   * Add columns to a table.
   *
   * @alias addColumn
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */
  public readonly addColumns: (...args: Parameters<tables.AddColumns>) => void;

  /**
   * Remove columns from a table.
   *
   * @alias dropColumn
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */
  public readonly dropColumns: (
    ...args: Parameters<tables.DropColumns>
  ) => void;

  /**
   * Rename a column.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */
  public readonly renameColumn: (
    ...args: Parameters<tables.RenameColumn>
  ) => void;

  /**
   * Change the definition of a column.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */
  public readonly alterColumn: (
    ...args: Parameters<tables.AlterColumn>
  ) => void;

  /**
   * Add a column to a table.
   *
   * @alias addColumns
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */
  public readonly addColumn: (...args: Parameters<tables.AddColumns>) => void;

  /**
   * Remove a column from a table.
   *
   * @alias dropColumns
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */
  public readonly dropColumn: (...args: Parameters<tables.DropColumns>) => void;

  /**
   * Add a constraint to a table.
   *
   * @alias createConstraint
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */
  public readonly addConstraint: (
    ...args: Parameters<tables.CreateConstraint>
  ) => void;

  /**
   * Remove a constraint from a table.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */
  public readonly dropConstraint: (
    ...args: Parameters<tables.DropConstraint>
  ) => void;

  /**
   * Rename a constraint.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */
  public readonly renameConstraint: (
    ...args: Parameters<tables.RenameConstraint>
  ) => void;

  /**
   * Add a constraint to a table.
   *
   * @alias addConstraint
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */

  public readonly createConstraint: (
    ...args: Parameters<tables.CreateConstraint>
  ) => void;

  /**
   * Define a new data type.
   *
   * @alias addType
   *
   * @see https://www.postgresql.org/docs/current/sql-createtype.html
   */
  public readonly createType: (...args: Parameters<types.CreateType>) => void;

  /**
   * Remove a data type.
   *
   * @see https://www.postgresql.org/docs/current/sql-droptype.html
   */
  public readonly dropType: (...args: Parameters<types.DropType>) => void;

  /**
   * Define a new data type.
   *
   * @alias createType
   *
   * @see https://www.postgresql.org/docs/current/sql-createtype.html
   */
  public readonly addType: (...args: Parameters<types.CreateType>) => void;

  /**
   * Rename a data type.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertype.html
   */
  public readonly renameType: (...args: Parameters<types.RenameType>) => void;

  /**
   * Rename a data type attribute.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertype.html
   */
  public readonly renameTypeAttribute: (
    ...args: Parameters<types.RenameTypeAttribute>
  ) => void;

  /**
   * Rename a data type value.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertype.html
   */
  public readonly renameTypeValue: (
    ...args: Parameters<types.RenameTypeValue>
  ) => void;

  /**
   * Add an attribute to a data type.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertype.html
   */
  public readonly addTypeAttribute: (
    ...args: Parameters<types.AddTypeAttribute>
  ) => void;

  /**
   * Remove an attribute from a data type.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertype.html
   */
  public readonly dropTypeAttribute: (
    ...args: Parameters<types.DropTypeAttribute>
  ) => void;

  /**
   * Set an attribute of a data type.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertype.html
   */
  public readonly setTypeAttribute: (
    ...args: Parameters<types.SetTypeAttribute>
  ) => void;

  /**
   * Add a value to a data type.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertype.html
   */
  public readonly addTypeValue: (
    ...args: Parameters<types.AddTypeValue>
  ) => void;

  /**
   * Define a new index.
   *
   * @alias addIndex
   *
   * @see https://www.postgresql.org/docs/current/sql-createindex.html
   */
  public readonly createIndex: (
    ...args: Parameters<indexes.CreateIndex>
  ) => void;

  /**
   * Remove an index.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropindex.html
   */
  public readonly dropIndex: (...args: Parameters<indexes.DropIndex>) => void;

  /**
   * Define a new index.
   *
   * @alias createIndex
   *
   * @see https://www.postgresql.org/docs/current/sql-createindex.html
   */
  public readonly addIndex: (...args: Parameters<indexes.CreateIndex>) => void;

  /**
   * Define a new database role.
   *
   * @see https://www.postgresql.org/docs/current/sql-createrole.html
   */
  public readonly createRole: (...args: Parameters<roles.CreateRole>) => void;

  /**
   * Remove a database role.
   *
   * @see https://www.postgresql.org/docs/current/sql-droprole.html
   */
  public readonly dropRole: (...args: Parameters<roles.DropRole>) => void;

  /**
   * Change a database role.
   *
   * @see https://www.postgresql.org/docs/current/sql-alterrole.html
   */
  public readonly alterRole: (...args: Parameters<roles.AlterRole>) => void;

  /**
   * Rename a database role.
   *
   * @see https://www.postgresql.org/docs/current/sql-alterrole.html
   */
  public readonly renameRole: (...args: Parameters<roles.RenameRole>) => void;

  /**
   * Define a new function.
   *
   * @see https://www.postgresql.org/docs/current/sql-createfunction.html
   */
  public readonly createFunction: (
    ...args: Parameters<functions.CreateFunction>
  ) => void;

  /**
   * Remove a function.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropfunction.html
   */
  public readonly dropFunction: (
    ...args: Parameters<functions.DropFunction>
  ) => void;

  /**
   * Rename a function.
   *
   * @see https://www.postgresql.org/docs/current/sql-alterfunction.html
   */
  public readonly renameFunction: (
    ...args: Parameters<functions.RenameFunction>
  ) => void;

  /**
   * Define a new trigger.
   *
   * @see https://www.postgresql.org/docs/current/sql-createtrigger.html
   */
  public readonly createTrigger: (
    ...args: Parameters<triggers.CreateTrigger>
  ) => void;

  /**
   * Remove a trigger.
   *
   * @see https://www.postgresql.org/docs/current/sql-droptrigger.html
   */
  public readonly dropTrigger: (
    ...args: Parameters<triggers.DropTrigger>
  ) => void;

  /**
   * Rename a trigger.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertrigger.html
   */
  public readonly renameTrigger: (
    ...args: Parameters<triggers.RenameTrigger>
  ) => void;

  /**
   * Define a new schema.
   *
   * @see https://www.postgresql.org/docs/current/sql-createschema.html
   */
  public readonly createSchema: (
    ...args: Parameters<schemas.CreateSchema>
  ) => void;

  /**
   * Remove a schema.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropschema.html
   */
  public readonly dropSchema: (...args: Parameters<schemas.DropSchema>) => void;

  /**
   * Rename a schema.
   *
   * @see https://www.postgresql.org/docs/current/sql-alterschema.html
   */
  public readonly renameSchema: (
    ...args: Parameters<schemas.RenameSchema>
  ) => void;

  /**
   * Define a new domain.
   *
   * @see https://www.postgresql.org/docs/current/sql-createdomain.html
   */
  public readonly createDomain: (
    ...args: Parameters<domains.CreateDomain>
  ) => void;

  /**
   * Remove a domain.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropdomain.html
   */
  public readonly dropDomain: (...args: Parameters<domains.DropDomain>) => void;

  /**
   * Change the definition of a domain.
   *
   * @see https://www.postgresql.org/docs/current/sql-alterdomain.html
   */
  public readonly alterDomain: (
    ...args: Parameters<domains.AlterDomain>
  ) => void;

  /**
   * Rename a domain.
   *
   * @see https://www.postgresql.org/docs/current/sql-alterdomain.html
   */
  public readonly renameDomain: (
    ...args: Parameters<domains.RenameDomain>
  ) => void;

  /**
   * Define a new sequence generator.
   *
   * @see https://www.postgresql.org/docs/current/sql-createsequence.html
   */
  public readonly createSequence: (
    ...args: Parameters<sequences.CreateSequence>
  ) => void;

  /**
   * Remove a sequence.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropsequence.html
   */
  public readonly dropSequence: (
    ...args: Parameters<sequences.DropSequence>
  ) => void;

  /**
   * Change the definition of a sequence generator.
   *
   * @see https://www.postgresql.org/docs/current/sql-altersequence.html
   */
  public readonly alterSequence: (
    ...args: Parameters<sequences.AlterSequence>
  ) => void;

  /**
   * Rename a sequence.
   *
   * @see https://www.postgresql.org/docs/current/sql-altersequence.html
   */
  public readonly renameSequence: (
    ...args: Parameters<sequences.RenameSequence>
  ) => void;

  /**
   * Define a new operator.
   *
   * @see https://www.postgresql.org/docs/current/sql-createoperator.html
   */
  public readonly createOperator: (
    ...args: Parameters<operators.CreateOperator>
  ) => void;

  /**
   * Remove an operator.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropoperator.html
   */
  public readonly dropOperator: (
    ...args: Parameters<operators.DropOperator>
  ) => void;

  /**
   * Define a new operator class.
   *
   * @see https://www.postgresql.org/docs/current/sql-createopclass.html
   */
  public readonly createOperatorClass: (
    ...args: Parameters<operators.CreateOperatorClass>
  ) => void;

  /**
   * Remove an operator class.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropopclass.html
   */
  public readonly dropOperatorClass: (
    ...args: Parameters<operators.DropOperatorClass>
  ) => void;

  /**
   * Rename an operator class.
   *
   * @see https://www.postgresql.org/docs/current/sql-alteropclass.html
   */
  public readonly renameOperatorClass: (
    ...args: Parameters<operators.RenameOperatorClass>
  ) => void;

  /**
   * Define a new operator family.
   *
   * @see https://www.postgresql.org/docs/current/sql-createopfamily.html
   */
  public readonly createOperatorFamily: (
    ...args: Parameters<operators.CreateOperatorFamily>
  ) => void;

  /**
   * Remove an operator family.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropopfamily.html
   */
  public readonly dropOperatorFamily: (
    ...args: Parameters<operators.DropOperatorFamily>
  ) => void;

  /**
   * Rename an operator family.
   *
   * @see https://www.postgresql.org/docs/current/sql-alteropfamily.html
   */
  public readonly renameOperatorFamily: (
    ...args: Parameters<operators.RenameOperatorFamily>
  ) => void;

  /**
   * Add an operator to an operator family.
   *
   * @see https://www.postgresql.org/docs/current/sql-alteropfamily.html
   */
  public readonly addToOperatorFamily: (
    ...args: Parameters<operators.AddToOperatorFamily>
  ) => void;

  /**
   * Remove an operator from an operator family.
   *
   * @see https://www.postgresql.org/docs/current/sql-alteropfamily.html
   */
  public readonly removeFromOperatorFamily: (
    ...args: Parameters<operators.RemoveFromOperatorFamily>
  ) => void;

  /**
   * Define a new row-level security policy for a table.
   *
   * @see https://www.postgresql.org/docs/current/sql-createpolicy.html
   */
  public readonly createPolicy: (
    ...args: Parameters<policies.CreatePolicy>
  ) => void;

  /**
   * Remove a row-level security policy from a table.
   *
   * @see https://www.postgresql.org/docs/current/sql-droppolicy.html
   */
  public readonly dropPolicy: (
    ...args: Parameters<policies.DropPolicy>
  ) => void;

  /**
   * Change the definition of a row-level security policy.
   *
   * @see https://www.postgresql.org/docs/current/sql-alterpolicy.html
   */
  public readonly alterPolicy: (
    ...args: Parameters<policies.AlterPolicy>
  ) => void;

  /**
   * Rename a row-level security policy.
   *
   * @see https://www.postgresql.org/docs/current/sql-alterpolicy.html
   */
  public readonly renamePolicy: (
    ...args: Parameters<policies.RenamePolicy>
  ) => void;

  /**
   * Define a new view.
   *
   * @see https://www.postgresql.org/docs/current/sql-createview.html
   */
  public readonly createView: (...args: Parameters<views.CreateView>) => void;

  /**
   * Remove a view.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropview.html
   */
  public readonly dropView: (...args: Parameters<views.DropView>) => void;

  /**
   * Change the definition of a view.
   *
   * @see https://www.postgresql.org/docs/current/sql-alterview.html
   */
  public readonly alterView: (...args: Parameters<views.AlterView>) => void;

  /**
   * Change the definition of a view column.
   *
   * @see https://www.postgresql.org/docs/current/sql-alterview.html
   */
  public readonly alterViewColumn: (
    ...args: Parameters<views.AlterViewColumn>
  ) => void;

  /**
   * Rename a view.
   *
   * @see https://www.postgresql.org/docs/current/sql-alterview.html
   */
  public readonly renameView: (...args: Parameters<views.RenameView>) => void;

  /**
   * Define a new materialized view.
   *
   * @see https://www.postgresql.org/docs/current/sql-creatematerializedview.html
   */
  public readonly createMaterializedView: (
    ...args: Parameters<mViews.CreateMaterializedView>
  ) => void;

  /**
   * Remove a materialized view.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropmaterializedview.html
   */
  public readonly dropMaterializedView: (
    ...args: Parameters<mViews.DropMaterializedView>
  ) => void;

  /**
   * Change the definition of a materialized view.
   *
   * @see https://www.postgresql.org/docs/current/sql-altermaterializedview.html
   */
  public readonly alterMaterializedView: (
    ...args: Parameters<mViews.AlterMaterializedView>
  ) => void;

  /**
   * Rename a materialized view.
   *
   * @see https://www.postgresql.org/docs/current/sql-altermaterializedview.html
   */
  public readonly renameMaterializedView: (
    ...args: Parameters<mViews.RenameMaterializedView>
  ) => void;

  /**
   * Rename a materialized view column.
   *
   * @see https://www.postgresql.org/docs/current/sql-altermaterializedview.html
   */
  public readonly renameMaterializedViewColumn: (
    ...args: Parameters<mViews.RenameMaterializedViewColumn>
  ) => void;

  /**
   * Replace the contents of a materialized view.
   *
   * @see https://www.postgresql.org/docs/current/sql-refreshmaterializedview.html
   */
  public readonly refreshMaterializedView: (
    ...args: Parameters<mViews.RefreshMaterializedView>
  ) => void;

  /**
   * Define access privileges.
   *
   * @see https://www.postgresql.org/docs/current/sql-grant.html
   */
  public readonly grantRoles: (...args: Parameters<grants.GrantRoles>) => void;

  /**
   * Remove access privileges.
   *
   * @see https://www.postgresql.org/docs/current/sql-revoke.html
   */
  public readonly revokeRoles: (
    ...args: Parameters<grants.RevokeRoles>
  ) => void;

  /**
   * Define access privileges.
   *
   * @see https://www.postgresql.org/docs/current/sql-grant.html
   */
  public readonly grantOnSchemas: (
    ...args: Parameters<grants.GrantOnSchemas>
  ) => void;

  /**
   * Remove access privileges.
   *
   * @see https://www.postgresql.org/docs/current/sql-revoke.html
   */
  public readonly revokeOnSchemas: (
    ...args: Parameters<grants.RevokeOnSchemas>
  ) => void;

  /**
   * Define access privileges.
   *
   * @see https://www.postgresql.org/docs/current/sql-grant.html
   */
  public readonly grantOnTables: (
    ...args: Parameters<grants.GrantOnTables>
  ) => void;

  /**
   * Remove access privileges.
   *
   * @see https://www.postgresql.org/docs/current/sql-revoke.html
   */
  public readonly revokeOnTables: (
    ...args: Parameters<grants.RevokeOnTables>
  ) => void;

  /**
   * Define a new cast.
   *
   * @see https://www.postgresql.org/docs/current/sql-createcast.html
   */
  public readonly createCast: (...args: Parameters<casts.CreateCast>) => void;

  /**
   * Remove a cast.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropcast.html
   */
  public readonly dropCast: (...args: Parameters<casts.DropCast>) => void;

  /**
   * Run raw SQL, with some optional _[very basic](http://mir.aculo.us/2011/03/09/little-helpers-a-tweet-sized-javascript-templating-engine/)_ mustache templating.
   *
   * This is a low-level operation, and you should use the higher-level operations whenever possible.
   *
   * @param sql SQL query to run.
   * @param args Optional `key/val` of arguments to replace.
   *
   * @see https://www.postgresql.org/docs/current/sql-commands.html
   */
  public readonly sql: (...args: Parameters<sql.Sql>) => void;

  /**
   * Inserts raw string, **which is not escaped**.
   *
   * @param sql String to **not escaped**.
   *
   * @example
   * { default: pgm.func('CURRENT_TIMESTAMP') }
   */
  public readonly func: (sql: string) => PgLiteral;

  /**
   * The `db` client instance.
   *
   * Can be used to run queries directly.
   */
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

  /**
   * Run the reverse of the migration. Useful for creating a new migration that
   * reverts a previous migration.
   */
  enableReverseMode(): this {
    this._REVERSE_MODE = true;
    return this;
  }

  /**
   * By default, all migrations are run in one transaction, but some DB
   * operations like add type value (`pgm.addTypeValue`) does not work if the
   * type is not created in the same transaction.
   * e.g. if it is created in previous migration. You need to run specific
   * migration outside a transaction (`pgm.noTransaction`).
   * Be aware that this means that you can have some migrations applied and some
   * not applied, if there is some error during migrating (leading to `ROLLBACK`).
   */
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
