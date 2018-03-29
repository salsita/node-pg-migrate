# Transpiling Babel or Typescript

You can use babel or typescript for transpiling migration files. It requires a little setup to use:

1.  Update `scripts` section in your `package.json` to contain `'migrate': 'node migrate.js'`
1.  Create `migrate.js` file with contents:

    ```
    // require('babel-core/register')( { ... your babel config ... } );
    // require('ts-node').register( { ... your typescript config ... } );
    require('./node_modules/node-pg-migrate/bin/node-pg-migrate');
    ```

    Uncomment/Use either babel or typescript hook and adjust your config for compiler.
    You can then use migration as usual via e.g. `npm run migrate up`. :tada:
