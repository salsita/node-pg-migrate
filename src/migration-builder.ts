/*
 The migration builder is used to actually create a migration from instructions

 A new instance of MigrationBuilder is instantiated and passed to the up or down block
 of each migration when it is being run.

 It makes the methods available via the pgm variable and stores up the sql commands.
 This is what makes it possible to do this without making everything async
 and it makes inference of down migrations possible.
 */

import { DB } from './db';
import {
  AddOptions,
  ColumnDefinitions,
  DropOptions,
  IfExistsOption,
  LiteralUnion,
  Name,
  Type,
  Value
} from './definitions';
import { DomainOptionsAlter, DomainOptionsCreate } from './operations/domains';
import { CreateExtensionOptions, Extension } from './operations/extensions';
import { FunctionOptions, FunctionParam } from './operations/functions';
import { CreateIndexOptions, DropIndexOptions } from './operations/indexes';
import {
  CreateOperatorClassOptions,
  CreateOperatorOptions,
  DropOperatorOptions,
  OperatorListDefinition
} from './operations/operators';
import { CreatePolicyOptions, PolicyOptions } from './operations/policies';
import { RoleOptions } from './operations/roles';
import {
  SequenceOptionsAlter,
  SequenceOptionsCreate
} from './operations/sequences';
import {
  AlterColumnOptions,
  AlterTableOptions,
  ConstraintOptions,
  TableOptions
} from './operations/tables';
import { TriggerOptions } from './operations/triggers';
import {
  AlterViewColumnOptions,
  AlterViewOptions,
  CreateViewOptions
} from './operations/views';
import { createSchemalize, PgLiteral } from './utils';

import * as domains from './operations/domains';
import * as extensions from './operations/extensions';
import * as functions from './operations/functions';
import * as indexes from './operations/indexes';
import * as operators from './operations/operators';
import * as other from './operations/other';
import * as policies from './operations/policies';
import * as roles from './operations/roles';
import * as schemas from './operations/schemas';
import * as sequences from './operations/sequences';
import * as tables from './operations/tables';
import * as triggers from './operations/triggers';
import * as types from './operations/types';
import * as views from './operations/views';
import * as mViews from './operations/viewsMaterialized';

export interface MigrationBuilderActions {
  up?: (pgm: MigrationBuilder) => Promise<void>;
  down?: (pgm: MigrationBuilder) => Promise<void>;
  shorthands?: ColumnDefinitions;
}

/* eslint-disable security/detect-non-literal-fs-filename */
export default class MigrationBuilder {
  public readonly createExtension: (
    extension: LiteralUnion<Extension> | Array<LiteralUnion<Extension>>,
    options?: CreateExtensionOptions
  ) => void;
  public readonly dropExtension: (
    extension: LiteralUnion<Extension> | Array<LiteralUnion<Extension>>,
    dropOptions?: DropOptions
  ) => void;
  public readonly addExtension: (
    extension: LiteralUnion<Extension> | Array<LiteralUnion<Extension>>,
    options?: CreateExtensionOptions
  ) => void;

  public readonly createTable: (
    tableName: Name,
    columns: ColumnDefinitions,
    options?: TableOptions
  ) => void;
  public readonly dropTable: (
    tableName: Name,
    dropOptions?: DropOptions
  ) => void;
  public readonly renameTable: (tableName: Name, newtableName: Name) => void;
  public readonly alterTable: (
    tableName: Name,
    alterOptions: AlterTableOptions
  ) => void;

  public readonly addColumns: (
    tableName: Name,
    newColumns: ColumnDefinitions,
    addOptions?: AddOptions
  ) => void;
  public readonly dropColumns: (
    tableName: Name,
    columns: string | string[] | { [name: string]: any },
    dropOptions?: DropOptions
  ) => void;
  public readonly renameColumn: (
    tableName: Name,
    oldColumnName: string,
    newColumnName: string
  ) => void;
  public readonly alterColumn: (
    tableName: Name,
    columnName: string,
    options: AlterColumnOptions
  ) => void;
  public readonly addColumn: (
    tableName: Name,
    newColumns: ColumnDefinitions,
    addOptions?: AddOptions
  ) => void;
  public readonly dropColumn: (
    tableName: Name,
    columns: string | string[] | { [name: string]: any },
    dropOptions?: DropOptions
  ) => void;

  public readonly addConstraint: (
    tableName: Name,
    constraintName: string | null,
    expression: string | ConstraintOptions
  ) => void;
  public readonly dropConstraint: (
    tableName: Name,
    constraintName: string,
    options?: DropOptions
  ) => void;
  public readonly renameConstraint: (
    tableName: Name,
    oldConstraintName: string,
    newConstraintName: string
  ) => void;
  public readonly createConstraint: (
    tableName: Name,
    constraintName: string | null,
    expression: string | ConstraintOptions
  ) => void;

  public readonly createType: (
    typeName: Name,
    values: Value[] | { [name: string]: Type }
  ) => void;
  public readonly dropType: (typeName: Name, dropOptions?: DropOptions) => void;
  public readonly addType: (
    typeName: Name,
    values: Value[] | { [name: string]: Type }
  ) => void;
  public readonly renameType: (typeName: Name, newTypeName: Name) => void;
  public readonly renameTypeAttribute: (
    typeName: Name,
    attributeName: string,
    newAttributeName: string
  ) => void;
  public readonly renameTypeValue: (
    typeName: Name,
    value: string,
    newValue: string
  ) => void;
  public readonly addTypeAttribute: (
    typeName: Name,
    attributeName: string,
    attributeType: Type
  ) => void;
  public readonly dropTypeAttribute: (
    typeName: Name,
    attributeName: string,
    options: IfExistsOption
  ) => void;
  public readonly setTypeAttribute: (
    typeName: Name,
    attributeName: string,
    attributeType: Type
  ) => void;
  public readonly addTypeValue: (
    typeName: Name,
    value: Value,
    options?: {
      ifNotExists?: boolean;
      before?: string;
      after?: string;
    }
  ) => void;

  public readonly createIndex: (
    tableName: Name,
    columns: string | string[],
    options?: CreateIndexOptions
  ) => void;
  public readonly dropIndex: (
    tableName: Name,
    columns: string | string[],
    options?: DropIndexOptions
  ) => void;
  public readonly addIndex: (
    tableName: Name,
    columns: string | string[],
    options?: CreateIndexOptions
  ) => void;

  public readonly createRole: (
    roleName: Name,
    roleOptions?: RoleOptions
  ) => void;
  public readonly dropRole: (roleName: Name, options?: IfExistsOption) => void;
  public readonly alterRole: (roleName: Name, roleOptions: RoleOptions) => void;
  public readonly renameRole: (oldRoleName: Name, newRoleName: Name) => void;

  public readonly createFunction: (
    functionName: Name,
    functionParams: FunctionParam[],
    functionOptions: FunctionOptions,
    definition: Value
  ) => void;
  public readonly dropFunction: (
    functionName: Name,
    functionParams: FunctionParam[],
    dropOptions?: DropOptions
  ) => void;
  public readonly renameFunction: (
    oldFunctionName: Name,
    functionParams: FunctionParam[],
    newFunctionName: Name
  ) => void;

  public readonly createTrigger:
    | ((
        tableName: Name,
        triggerName: Name,
        triggerOptions: TriggerOptions
      ) => void)
    | ((
        tableName: Name,
        triggerName: Name,
        triggerOptions: TriggerOptions & FunctionOptions,
        definition: Value
      ) => void);
  public readonly dropTrigger: (
    tableName: Name,
    triggerName: Name,
    dropOptions?: DropOptions
  ) => void;
  public readonly renameTrigger: (
    tableName: Name,
    oldTriggerName: Name,
    newTriggerName: Name
  ) => void;

  public readonly createSchema: (
    schemaName: string,
    schemaOptions?: {
      ifNotExists?: boolean;
      authorization?: string;
    }
  ) => void;
  public readonly dropSchema: (
    schemaName: string,
    dropOptions?: DropOptions
  ) => void;
  public readonly renameSchema: (
    oldSchemaName: string,
    newSchemaName: string
  ) => void;

  public readonly createDomain: (
    domainName: Name,
    type: Type,
    domainOptions?: DomainOptionsCreate
  ) => void;
  public readonly dropDomain: (
    domainName: Name,
    dropOptions?: DropOptions
  ) => void;
  public readonly alterDomain: (
    domainName: Name,
    domainOptions: DomainOptionsAlter
  ) => void;
  public readonly renameDomain: (
    oldDomainName: Name,
    newDomainName: Name
  ) => void;

  public readonly createSequence: (
    sequenceName: Name,
    sequenceOptions?: SequenceOptionsCreate
  ) => void;
  public readonly dropSequence: (
    sequenceName: Name,
    dropOptions?: DropOptions
  ) => void;
  public readonly alterSequence: (
    sequenceName: Name,
    sequenceOptions: SequenceOptionsAlter
  ) => void;
  public readonly renameSequence: (
    oldSequenceName: Name,
    newSequenceName: Name
  ) => void;

  public readonly createOperator: (
    operatorName: Name,
    options?: CreateOperatorOptions
  ) => void;
  public readonly dropOperator: (
    operatorName: Name,
    dropOptions?: DropOperatorOptions
  ) => void;
  public readonly createOperatorClass: (
    operatorClassName: Name,
    type: Type,
    indexMethod: Name,
    operatorList: OperatorListDefinition,
    options: CreateOperatorClassOptions
  ) => void;
  public readonly dropOperatorClass: (
    operatorClassName: Name,
    indexMethod: Name,
    dropOptions?: DropOptions
  ) => void;
  public readonly renameOperatorClass: (
    oldOperatorClassName: Name,
    indexMethod: Name,
    newOperatorClassName: Name
  ) => void;
  public readonly createOperatorFamily: (
    operatorFamilyName: Name,
    indexMethod: Name
  ) => void;
  public readonly dropOperatorFamily: (
    operatorFamilyName: Name,
    newSchemaName: Name,
    dropOptions?: DropOptions
  ) => void;
  public readonly renameOperatorFamily: (
    oldOperatorFamilyName: Name,
    indexMethod: Name,
    newOperatorFamilyName: Name
  ) => void;
  public readonly addToOperatorFamily: (
    operatorFamilyName: Name,
    indexMethod: Name,
    operatorList: OperatorListDefinition
  ) => void;
  public readonly removeFromOperatorFamily: (
    operatorFamilyName: Name,
    indexMethod: Name,
    operatorList: OperatorListDefinition
  ) => void;

  public readonly createPolicy: (
    tableName: Name,
    policyName: string,
    options?: CreatePolicyOptions
  ) => void;
  public readonly dropPolicy: (
    tableName: Name,
    policyName: string,
    options?: IfExistsOption
  ) => void;
  public readonly alterPolicy: (
    tableName: Name,
    policyName: string,
    options: PolicyOptions
  ) => void;
  public readonly renamePolicy: (
    tableName: Name,
    policyName: string,
    newPolicyName: string
  ) => void;

  public readonly createView: (
    viewName: Name,
    options: CreateViewOptions,
    definition: string
  ) => void;
  public readonly dropView: (viewName: Name, options?: DropOptions) => void;
  public readonly alterView: (
    viewName: Name,
    options: AlterViewOptions
  ) => void;
  public readonly alterViewColumn: (
    viewName: Name,
    options: AlterViewColumnOptions
  ) => void;
  public readonly renameView: (viewName: Name, newViewName: Name) => void;

  public readonly createMaterializedView: (
    viewName: Name,
    options: mViews.CreateMaterializedViewOptions,
    definition: string
  ) => void;
  public readonly dropMaterializedView: (
    viewName: Name,
    options?: DropOptions
  ) => void;
  public readonly alterMaterializedView: (
    viewName: Name,
    options: mViews.AlterMaterializedViewOptions
  ) => void;
  public readonly renameMaterializedView: (
    viewName: Name,
    newViewName: Name
  ) => void;
  public readonly renameMaterializedViewColumn: (
    viewName: Name,
    columnName: string,
    newColumnName: string
  ) => void;
  public readonly refreshMaterializedView: (
    viewName: Name,
    options?: mViews.RefreshMaterializedViewOptions
  ) => void;

  public readonly sql: (sql: string, args?: object) => void;
  public readonly func: (sql: string) => PgLiteral;
  public readonly db: DB;

  private _steps: any[];
  private _REVERSE_MODE: boolean;
  private _use_transaction: boolean;

  constructor(db: DB, typeShorthands, shouldDecamelize: boolean) {
    this._steps = [];
    this._REVERSE_MODE = false;
    // by default, all migrations are wrapped in a transaction
    this._use_transaction = true;

    // this function wraps each operation within a function that either
    // calls the operation or its reverse, and appends the result (array of sql statements)
    // to the  steps array
    const wrap = operation => (...args) => {
      if (this._REVERSE_MODE && typeof operation.reverse !== 'function') {
        const name = `pgm.${operation.name}()`;
        throw new Error(
          `Impossible to automatically infer down migration for "${name}"`
        );
      }
      this._steps = this._steps.concat(
        this._REVERSE_MODE ? operation.reverse(...args) : operation(...args)
      );
    };

    const options = {
      typeShorthands,
      schemalize: createSchemalize(shouldDecamelize, false),
      literal: createSchemalize(shouldDecamelize, true)
    };

    // defines the methods that are accessible via pgm in each migrations
    // there are some convenience aliases to make usage easier
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

    this.sql = wrap(other.sql(options));

    // Other utilities which may be useful
    // .func creates a string which will not be escaped
    // common uses are for PG functions, ex: { ... default: pgm.func('NOW()') }
    this.func = PgLiteral.create;

    // expose DB so we can access database within transaction
    const wrapDB = operation => (...args) => {
      if (this._REVERSE_MODE) {
        throw new Error('Impossible to automatically infer down migration');
      }
      return operation(...args);
    };
    this.db = {
      query: wrapDB(db.query),
      select: wrapDB(db.select)
    };
  }

  enableReverseMode() {
    this._REVERSE_MODE = true;
    return this;
  }

  public noTransaction(): this {
    this._use_transaction = false;
    return this;
  }

  isUsingTransaction() {
    return this._use_transaction;
  }

  getSql() {
    return `${this.getSqlSteps().join('\n')}\n`;
  }

  getSqlSteps() {
    // in reverse mode, we flip the order of the statements
    return this._REVERSE_MODE ? this._steps.slice().reverse() : this._steps;
  }
}
/* eslint-enable security/detect-non-literal-fs-filename */
