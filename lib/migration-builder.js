/*
 The migration builder is used to actually create a migration from instructions

 A new instance of MigrationBuilder is instantiated and passed to the up or down block
 of each migration when it is being run.

 It makes the methods available via the pgm variable and stores up the sql commands.
 This is what makes it possible to do this without making everything async
 and it makes inference of down migrations possible.
 */

const { PgLiteral } = require("./utils");

const extensions = require("./operations/extensions");
const indexes = require("./operations/indexes");
const tables = require("./operations/tables");
const types = require("./operations/types");
const roles = require("./operations/roles");
const functions = require("./operations/functions");
const triggers = require("./operations/triggers");
const schemas = require("./operations/schemas");
const domains = require("./operations/domains");
const sequences = require("./operations/sequences");
const operators = require("./operations/operators");
const policies = require("./operations/policies");
const views = require("./operations/views");
const mViews = require("./operations/viewsMaterialized");
const other = require("./operations/other");

/* eslint-disable security/detect-non-literal-fs-filename */
module.exports = class MigrationBuilder {
  constructor(typeShorthands, db) {
    this._steps = [];
    this._REVERSE_MODE = false;
    // by default, all migrations are wrapped in a transaction
    this._use_transaction = true;

    // this function wraps each operation within a function that either
    // calls the operation or its reverse, and appends the result (array of sql statements)
    // to the  steps array
    const wrap = operation => (...args) => {
      if (this._REVERSE_MODE && typeof operation.reverse !== "function") {
        const name = `pgm.${operation.name}()`;
        throw new Error(
          `Impossible to automatically infer down migration for "${name}"`
        );
      }
      this._steps = this._steps.concat(
        this._REVERSE_MODE ? operation.reverse(...args) : operation(...args)
      );
    };

    // defines the methods that are accessible via pgm in each migrations
    // there are some convenience aliases to make usage easier
    this.createExtension = wrap(extensions.createExtension);
    this.dropExtension = wrap(extensions.dropExtension);
    this.addExtension = this.createExtension;

    this.createTable = wrap(tables.createTable(typeShorthands));
    this.dropTable = wrap(tables.dropTable);
    this.renameTable = wrap(tables.renameTable);
    this.alterTable = wrap(tables.alterTable);

    this.addColumns = wrap(tables.addColumns(typeShorthands));
    this.dropColumns = wrap(tables.dropColumns);
    this.renameColumn = wrap(tables.renameColumn);
    this.alterColumn = wrap(tables.alterColumn(typeShorthands));
    this.addColumn = this.addColumns;
    this.dropColumn = this.dropColumns;

    this.addConstraint = wrap(tables.addConstraint);
    this.dropConstraint = wrap(tables.dropConstraint);
    this.renameConstraint = wrap(tables.renameConstraint);
    this.createConstraint = this.addConstraint;

    this.createType = wrap(types.createType(typeShorthands));
    this.dropType = wrap(types.dropType);
    this.addType = this.createType;
    this.renameType = wrap(types.renameType);
    this.renameTypeAttribute = wrap(types.renameTypeAttribute);
    this.renameTypeValue = wrap(types.renameTypeValue);
    this.addTypeAttribute = wrap(types.addTypeAttribute(typeShorthands));
    this.dropTypeAttribute = wrap(types.dropTypeAttribute);
    this.setTypeAttribute = wrap(types.setTypeAttribute(typeShorthands));
    this.addTypeValue = wrap(types.addTypeValue);

    this.createIndex = wrap(indexes.createIndex);
    this.dropIndex = wrap(indexes.dropIndex);
    this.addIndex = this.createIndex;

    this.createRole = wrap(roles.createRole);
    this.dropRole = wrap(roles.dropRole);
    this.alterRole = wrap(roles.alterRole);
    this.renameRole = wrap(roles.renameRole);

    this.createFunction = wrap(functions.createFunction(typeShorthands));
    this.dropFunction = wrap(functions.dropFunction(typeShorthands));
    this.renameFunction = wrap(functions.renameFunction(typeShorthands));

    this.createTrigger = wrap(triggers.createTrigger(typeShorthands));
    this.dropTrigger = wrap(triggers.dropTrigger);
    this.renameTrigger = wrap(triggers.renameTrigger);

    this.createSchema = wrap(schemas.createSchema);
    this.dropSchema = wrap(schemas.dropSchema);
    this.renameSchema = wrap(schemas.renameSchema);

    this.createDomain = wrap(domains.createDomain(typeShorthands));
    this.dropDomain = wrap(domains.dropDomain);
    this.alterDomain = wrap(domains.alterDomain);
    this.renameDomain = wrap(domains.renameDomain);

    this.createSequence = wrap(sequences.createSequence(typeShorthands));
    this.dropSequence = wrap(sequences.dropSequence);
    this.alterSequence = wrap(sequences.alterSequence(typeShorthands));
    this.renameSequence = wrap(sequences.renameSequence);

    this.createOperator = wrap(operators.createOperator);
    this.dropOperator = wrap(operators.dropOperator);
    this.createOperatorClass = wrap(
      operators.createOperatorClass(typeShorthands)
    );
    this.dropOperatorClass = wrap(operators.dropOperatorClass);
    this.renameOperatorClass = wrap(operators.renameOperatorClass);
    this.createOperatorFamily = wrap(operators.createOperatorFamily);
    this.dropOperatorFamily = wrap(operators.dropOperatorFamily);
    this.renameOperatorFamily = wrap(operators.renameOperatorFamily);
    this.addToOperatorFamily = wrap(
      operators.addToOperatorFamily(typeShorthands)
    );
    this.removeFromOperatorFamily = wrap(
      operators.removeFromOperatorFamily(typeShorthands)
    );

    this.createPolicy = wrap(policies.createPolicy);
    this.dropPolicy = wrap(policies.dropPolicy);
    this.alterPolicy = wrap(policies.alterPolicy);
    this.renamePolicy = wrap(policies.renamePolicy);

    this.createView = wrap(views.createView);
    this.dropView = wrap(views.dropView);
    this.alterView = wrap(views.alterView);
    this.alterViewColumn = wrap(views.alterViewColumn);
    this.renameView = wrap(views.renameView);

    this.createMaterializedView = wrap(mViews.createMaterializedView);
    this.dropMaterializedView = wrap(mViews.dropMaterializedView);
    this.alterMaterializedView = wrap(mViews.alterMaterializedView);
    this.renameMaterializedView = wrap(mViews.renameMaterializedView);
    this.renameMaterializedViewColumn = wrap(
      mViews.renameMaterializedViewColumn
    );
    this.refreshMaterializedView = wrap(mViews.refreshMaterializedView);

    this.sql = wrap(other.sql);

    // Other utilities which may be useful
    // .func creates a string which will not be escaped
    // common uses are for PG functions, ex: { ... default: pgm.func('NOW()') }
    this.func = PgLiteral.create;

    // expose DB so we can access database within transaction
    const wrapDB = operation => (...args) => {
      if (this._REVERSE_MODE) {
        throw new Error("Impossible to automatically infer down migration");
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
    return `${this.getSqlSteps().join("\n")}\n`;
  }

  getSqlSteps() {
    // in reverse mode, we flip the order of the statements
    return this._REVERSE_MODE ? this._steps.slice().reverse() : this._steps;
  }
};
/* eslint-enable security/detect-non-literal-fs-filename */
