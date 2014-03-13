var fs     = require('fs');
var mkdirp = require('mkdirp');
var path   = require('path');
var util   = require('util');
var _      = require('lodash');
var sprintf = require("sprintf-js").sprintf;
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
      var sql = 'BEGIN; '+"\n";
      sql += pgm.getSql();
      sql += "INSERT INTO pgmigrations (name, run_on) VALUES ('"+self.name+"', NOW()); "+"\n";
      sql += 'COMMIT;';

      console.log('### MIGRATION '+self.name+' (up) ###')
      console.log( sql );

      db.query(sql, function(err, result){
        if (err) return done(err);

        done();
      })

      
      
    })
  }
  self.applyDown = function(done){
    var pgm = new MigrationBuilder();
    self.down(pgm, function(){
      console.log( pgm.getSql() );
      done();
    })
  }
}

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


