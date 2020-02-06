# Transpiling

## Transpiling Babel

You can use babel for transpiling migration files. You have e.g. these options:

### Use global configuration

1.  Update `scripts` section in your `package.json` to contain `"migrate": "babel-node node_modules/node-pg-migrate/bin/node-pg-migrate"`

### Use custom configuration

It requires a little setup to use:

1.  Update `scripts` section in your `package.json` to contain `'migrate': 'node migrate.js'`
1.  Create `migrate.js` file with contents:

    ```
    require('babel-core/register')( { ... your babel config ... } );
    require('./node_modules/node-pg-migrate/bin/node-pg-migrate');
    ```

## Transpiling Typescript

### Use flag

Typescript is supported out of the box. You need to have installed `ts-node` package and need to pass `tsconfig` arg ([see](cli.md#configuration))

### Use global configuration

Another option is to use [ts-node](https://www.npmjs.com/package/ts-node) CLI directly and it needs to be available globally or as a dependency.

```
"migrate": "ts-node node_modules/.bin/node-pg-migrate -j ts",
```

### Use custom configuration

If you need some more advanced TS config, you need to register transpiler yourself like in using babel configuration.

```
const config = { ... your ts config ... }
require('ts-node').register(config);
// e.g. require("tsconfig-paths").register(config.compilerOptions);
require('./node_modules/node-pg-migrate/bin/node-pg-migrate');
```
