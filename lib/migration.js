/*
 A new Migration is instantiated for each migration file.

 It is responsible for storing the name of the file and knowing how to execute
 the up and down migrations defined in the file.

 */

import fs from 'fs';
import mkdirp from 'mkdirp';
import path from 'path';
import util from 'util';
import async from 'async';

import MigrationBuilder from './migration-builder';

const UP = 'UP';
const DOWN = 'DOWN';

class Migration {

  // class method that creates a new migration file by cloning the migration template
  static create(name, directory) {
    // ensure the migrations directory exists
    mkdirp.sync(directory);

    // file name looks like migrations/1391877300255_migration-title.js
    const new_file = util.format('%s/%d_%s.js', directory, +new Date(), name);

    // copy the default migration template to the new file location
    fs.createReadStream(path.resolve(__dirname, './migration-template.js'))
      .pipe(fs.createWriteStream(new_file));

    return new Migration(new_file);
  }

  constructor(db, migrationPath, actions = {}, options = {}) {
    this.db = db;
    this.path = migrationPath;
    this.name = migrationPath.split('/').pop().replace(/\.js$/, '');
    this.up = actions.up;
    this.down = actions.down;
    this.options = options;
  }

  _applyComplete(direction, pgm, done) {
    console.log(`### MIGRATION ${this.name} (${direction}) ###`);

    const sql_steps = pgm.getSqlSteps();

    switch (direction) {
      case UP:
        sql_steps.push(`INSERT INTO "${this.options.migrations_schema}"."${this.options.migrations_table}" (name, run_on) VALUES ('${this.name}', NOW());`);
        break;
      case DOWN:
        sql_steps.push(`DELETE FROM "${this.options.migrations_schema}"."${this.options.migrations_table}" WHERE name='${this.name}';`);
        break;
      default:
        throw new Error(`Unknown direction "${direction}"`);
    }

    if (pgm.use_transaction) {
      // wrap in a transaction, combine into one sql statement
      sql_steps.unshift('BEGIN;');
      sql_steps.push('COMMIT;');
    } else {
      console.log('#> WARNING: This migration is not wrapped in a transaction! <');
    }

    console.log(`${sql_steps.join('\n')}\n\n`);

    if (!this.options.dryRun) {
      async.eachSeries(sql_steps, (sql, next_step) => {
        this.db.query(sql, next_step);
      }, done);
    } else {
      done();
    }
  }

  applyUp(done) {
    const pgm = new MigrationBuilder();

    const upComplete = this._applyComplete.bind(this, UP, pgm, done);

    if (this.up.length === 2) {
      this.up(pgm, upComplete);
    } else {
      this.up(pgm);
      upComplete();
    }
  }

  applyDown(done) {
    const pgm = new MigrationBuilder();

    if (this.down === false) {
      done(`User has disabled down migration on file: ${this.name}`);
      return;
    } else if (this.down === undefined) {
      // automatically infer the down migration by running the up migration in reverse mode...
      pgm.enableReverseMode();
      this.down = this.up;
    }

    const downComplete = this._applyComplete.bind(this, DOWN, pgm, done);

    if (this.down.length === 2) {
      this.down(pgm, downComplete);
    } else {
      this.down(pgm);
      downComplete();
    }
  }
}

export default Migration;
