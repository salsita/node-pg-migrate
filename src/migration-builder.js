/*
 The migration builder is used to actually create a migration from instructions

 A new instance of MigrationBuilder is instantiated and passed to the up or down block
 of each migration when it is being run.

 It makes the methods available via the pgm variable and stores up the sql commands.
 This is what makes it possible to do this without making everything async
 and it makes inference of down migrations possible.
 */

const { PgLiteral, createSchemalize } = require('./utils');

const extensions = require('./operations/extensions');
const indexes = require('./operations/indexes');
const tables = require('./operations/tables');
const types = require('./operations/types');
const roles = require('./operations/roles');
const functions = require('./operations/functions');
const triggers = require('./operations/triggers');
const schemas = require('./operations/schemas');
const domains = require('./operations/domains');
const sequences = require('./operations/sequences');
const operators = require('./operations/operators');
const policies = require('./operations/policies');
const views = require('./operations/views');
const mViews = require('./operations/viewsMaterialized');
const other = require('./operations/other');

/* eslint-disable security/detect-non-literal-fs-filename */
module.exports = class MigrationBuilder {
  constructor(db, typeShorthands, shouldDecamelize) {
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

  noTransaction() {
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
};
/* eslint-enable security/detect-non-literal-fs-filename */
