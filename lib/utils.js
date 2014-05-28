module.exports = {
  // teeny templating function
  // http://mir.aculo.us/2011/03/09/little-helpers-a-tweet-sized-javascript-templating-engine/
  t: function(s,d){
    for(var p in d)
      s=s.replace(new RegExp('{'+p+'}','g'), d[p]);
    return s;
  },
  escapeValue: function ( val ){
    // TODO: figure out a solution for unescaping functions -- ex: NOW()
    if ( val === null ) return 'NULL';
    if ( typeof val === 'boolean' ) return val.toString();
    if ( typeof val === 'string' ) return "'"+escape(val)+"'";
    if ( typeof val === 'number' ) return val;
    if ( val instanceof PgLiteral ) return val.toString();
  },
  PgLiteral: PgLiteral
}

// This is used to create unescaped strings
// exposed in the migrations via pgm.func
function PgLiteral(str){
  this.toString = function(){
    return str;
  }
}
PgLiteral.create = function(str){
  return new PgLiteral(str);
}