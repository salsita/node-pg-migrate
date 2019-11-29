# Transpiling Babel or Typescript

You can use babel or typescript for transpiling migration files. You have e.g. these options:

### Use global configuration

1.  Update `scripts` section in your `package.json` to contain `"migrate": "babel-node node_modules/node-pg-migrate/bin/node-pg-migrate"`

### Use custom configuration

It requires a little setup to use:

1.  Update `scripts` section in your `package.json` to contain `'migrate': 'node migrate.js'`
1.  Create `migrate.js` file with contents:

    ```
    // require('babel-core/register')( { ... your babel config ... } );
    // require('ts-node').register( { ... your typescript config ... } );
    require('./node_modules/node-pg-migrate/bin/node-pg-migrate');
    ```

    Uncomment/Use either babel or typescript hook and adjust your config for compiler.
    You can then use migration as usual via e.g. `npm run migrate up`. :tada:

Another option is to use [ts-node](https://www.npmjs.com/package/ts-node) CLI directly and it needs to be available globally or as a dependency.
If migrations are in the `/src/migrations` folder then the path can still be referenced with the `-m` CLI option.

```
"migrate": "ts-node node_modules/.bin/node-pg-migrate -m src/migrations -j ts",
```
