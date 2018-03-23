/*
 The migration builder is used to actually create a migration from instructions

 A new instance of MigrationBuilder is instantiated and passed to the up or down block
 of each migration when it is being run.

 It makes the methods available via the pgm variable and stores up the sql commands.
 This is what makes it possible to do this without making everything async
 and it makes inference of down migrations possible.
 */

import { PgLiteral } from './utils';

import * as extensions from './operations/extensions';
import * as indexes from './operations/indexes';
import * as tables from './operations/tables';
import * as types from './operations/types';
import * as roles from './operations/roles';
import * as functions from './operations/functions';
import * as triggers from './operations/triggers';
import * as schemas from './operations/schemas';
import * as domains from './operations/domains';
import * as sequences from './operations/sequences';
import * as operators from './operations/operators';
import * as policies from './operations/policies';
import * as other from './operations/other';

export default class MigrationBuilder {
  constructor(options = {}, db) {
    this._steps = [];
    this._REVERSE_MODE = false;
    // by default, all migrations are wrapped in a transaction
    this._use_transaction = true;

    // this function wraps each operation within a function that either
    // calls the operation or its reverse, and appends the result (array of sql statements)
    // to the  steps array
    const wrap = operation => (...args) => {
      if (this._REVERSE_MODE && typeof operation.reverse !== 'function') {
        throw new Error('Impossible to automatically infer down migration');
      }
      this._steps = this._steps.concat(
        this._REVERSE_MODE
          ? operation.reverse(...args)
          : operation(...args)
      );
    };

    // defines the methods that are accessible via pgm in each migrations
    // there are some convenience aliases to make usage easier
    this.createExtension = wrap(extensions.create);
    this.dropExtension = wrap(extensions.drop);
    this.addExtension = this.createExtension;

    this.createTable = wrap(tables.create(options.typeShorthands));
    this.dropTable = wrap(tables.drop);
    this.renameTable = wrap(tables.renameTable);
    this.alterTable = wrap(tables.alter);

    this.addColumns = wrap(tables.addColumns(options.typeShorthands));
    this.dropColumns = wrap(tables.dropColumns);
    this.renameColumn = wrap(tables.renameColumn);
    this.alterColumn = wrap(tables.alterColumn);
    this.addColumn = this.addColumns;
    this.dropColumn = this.dropColumns;

    this.addConstraint = wrap(tables.addConstraint);
    this.dropConstraint = wrap(tables.dropConstraint);
    this.renameConstraint = wrap(tables.renameConstraint);
    this.createConstraint = this.addConstraint;

    this.createType = wrap(types.create(options.typeShorthands));
    this.dropType = wrap(types.drop);
    this.addType = this.createType;
    this.renameType = wrap(types.rename);
    this.renameTypeAttribute = wrap(types.renameTypeAttribute);
    this.addTypeAttribute = wrap(types.addTypeAttribute(options.typeShorthands));
    this.dropTypeAttribute = wrap(types.dropTypeAttribute);
    this.setTypeAttribute = wrap(types.setTypeAttribute(options.typeShorthands));
    this.addTypeValue = wrap(types.addTypeValue);

    this.createIndex = wrap(indexes.create);
    this.dropIndex = wrap(indexes.drop);
    this.addIndex = this.createIndex;

    this.createRole = wrap(roles.create);
    this.dropRole = wrap(roles.drop);
    this.alterRole = wrap(roles.alter);
    this.renameRole = wrap(roles.rename);

    this.createFunction = wrap(functions.create(options.typeShorthands));
    this.dropFunction = wrap(functions.drop(options.typeShorthands));
    this.renameFunction = wrap(functions.rename(options.typeShorthands));

    this.createTrigger = wrap(triggers.create(options.typeShorthands));
    this.dropTrigger = wrap(triggers.drop);
    this.renameTrigger = wrap(triggers.rename);

    this.createSchema = wrap(schemas.create);
    this.dropSchema = wrap(schemas.drop);
    this.renameSchema = wrap(schemas.rename);

    this.createDomain = wrap(domains.create(options.typeShorthands));
    this.dropDomain = wrap(domains.drop);
    this.alterDomain = wrap(domains.alter);
    this.renameDomain = wrap(domains.rename);

    this.createSequence = wrap(sequences.create(options.typeShorthands));
    this.dropSequence = wrap(sequences.drop);
    this.alterSequence = wrap(sequences.alter(options.typeShorthands));
    this.renameSequence = wrap(sequences.rename);

    this.createOperator = wrap(operators.createOperator);
    this.dropOperator = wrap(operators.dropOperator);
    this.createOperatorClass = wrap(operators.createOperatorClass(options.typeShorthands));
    this.dropOperatorClass = wrap(operators.dropOperatorClass);
    this.renameOperatorClass = wrap(operators.renameOperatorClass);
    this.createOperatorFamily = wrap(operators.createOperatorFamily);
    this.dropOperatorFamily = wrap(operators.dropOperatorFamily);
    this.renameOperatorFamily = wrap(operators.renameOperatorFamily);
    this.addToOperatorFamily = wrap(operators.addToOperatorFamily(options.typeShorthands));
    this.removeFromOperatorFamily = wrap(operators.removeFromOperatorFamily(options.typeShorthands)); // eslint-disable-line max-len

    this.createPolicy = wrap(policies.create);
    this.dropPolicy = wrap(policies.drop);
    this.alterPolicy = wrap(policies.alter);
    this.renamePolicy = wrap(policies.rename);

    this.sql = wrap(other.sql);

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
      select: wrapDB(db.select),
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
}
