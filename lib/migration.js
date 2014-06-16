/*
  A new Migration is instantiated for each migration file.

  It is responsible for storing the name of the file and knowing how to execute
  the up and down migrations defined in the file.

*/


var fs     = require('fs');
var mkdirp = require('mkdirp');
var path   = require('path');
var util   = require('util');
var async  = require('async');
var _      = require('lodash');

var utils  = require('./utils');
var MigrationBuilder = require('./migration-builder');
var db = require('./db');

var Migration = function(path, actions){
  var self = this;
  this.path = path;
  this.name = path.split('/').pop().replace(/\.js$/, '');
  actions = actions || {};
  this.up = actions.up;
  this.down = actions.down;

  self.applyUp = function(done){
    var pgm = new MigrationBuilder();
    self.up(pgm, function(){
      console.log('### MIGRATION '+self.name+' (up) ###')

      var sql_steps = pgm.getSqlSteps();
      sql_steps.push( utils.t("INSERT INTO pgmigrations (name, run_on) VALUES ('{name}', NOW());\n", { name: self.name }) );

      if (pgm.use_transaction){
        // wrap in a transaction, combine into one sql statement
        sql_steps.unshift('BEGIN;');
        sql_steps.push('COMMIT;');
        var sql_steps = [sql_steps.join("\n")];
      } else {
        console.log('> WARNING: This migration is not wrapped in a transaction! <')
      }

      console.log( sql_steps.join("\n") );

      async.eachSeries(sql_steps, function(sql, next_step){
        db.query(sql, next_step);
      }, done);
    })
  }
  self.applyDown = function(done){
    var pgm = new MigrationBuilder();

    if (self.down === false){
      return done('User has disabled down migration on file: '+self.name);
    } else if (self.down === undefined){
      // automatically infer the down migration by running the up migration in reverse mode...
      pgm.enableReverseMode();
      self.down = self.up;
    }

    self.down(pgm, function(){
      var sql = 'BEGIN; '+"\n";
      sql += pgm.getSql();
      sql += utils.t("DELETE FROM pgmigrations WHERE name='{name}';\n", { name: self.name });
      sql += 'COMMIT;';

      console.log('### MIGRATION '+self.name+' (down) ###')
      console.log( sql );

      db.query(sql, function(err, result){
        if (err) return done(err);

        done();
      });
    });
  }
}

// class method that creates a new migration file by cloning the migration template
Migration.create = function(name, directory){

  // ensure the migrations directory exists
  mkdirp.sync(directory);

  // file name looks like migrations/1391877300255_migration-title.js
  var new_file = util.format('%s/%d_%s.js', directory, +new Date(), name);

  // copy the default migration template to the new file location
  fs.createReadStream( path.resolve(__dirname, './migration-template.js'))
    .pipe(fs.createWriteStream( new_file ));

  return new Migration( new_file );
}

module.exports = Migration;


