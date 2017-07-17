/*
 The migration builder is used to actually create a migration from instructions

 A new instance of MigrationBuilder is instantiated and passed to the up or down block
 of each migration when it is being run.

 It makes the methods available via the pgm variable and stores up the sql commands.
 This is what makes it possible to do this without making everything async
 and it makes inferrence of down migrations possible.


 */

import { PgLiteral } from './utils';

import * as extensions from './operations/extensions';
import * as indexes from './operations/indexes';
import * as tables from './operations/tables';
import * as roles from './operations/roles';
import * as other from './operations/other';

export default class MigrationBuilder {
  constructor(options = {}) {
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

    this.addColumns = wrap(tables.addColumns(options.typeShorthands));
    this.dropColumns = wrap(tables.dropColumns);
    this.renameColumn = wrap(tables.renameColumn);
    this.alterColumn = wrap(tables.alterColumn);
    this.addColumn = this.addColumns;
    this.dropColumn = this.dropColumns;

    this.addConstraint = wrap(tables.addConstraint);
    this.dropConstraint = wrap(tables.dropConstraint);
    this.createConstraint = this.addConstraint;

    this.createType = wrap(tables.createType);
    this.dropType = wrap(tables.dropType);
    this.alterType = wrap(tables.alterType);
    this.addType = this.createType;

    this.createIndex = wrap(indexes.create);
    this.dropIndex = wrap(indexes.drop);
    this.addIndex = this.createIndex;

    this.createRole = wrap(roles.create);
    this.dropRole = wrap(roles.drop);
    this.alterRole = wrap(roles.alter);
    this.renameRole = wrap(roles.rename);

    this.sql = wrap(other.sql);

    // Other utilities which may be useful
    // .func creates a string which will not be escaped
    // common uses are for PG functions, ex: { ... default: pgm.func('NOW()') }
    this.func = PgLiteral.create;
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
