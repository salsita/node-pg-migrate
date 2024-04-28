# Extension Operations

## Operation: `createExtension`

#### `pgm.createExtension( extension )`

> [!IMPORTANT]
> Install postgres extension(s) - [postgres docs](http://www.postgresql.org/docs/current/static/sql-createextension.html.html)
>
> Alias: `addExtension`

### Arguments

| Name        | Type                        | Description                       |
| ----------- | --------------------------- | --------------------------------- |
| `extension` | `string` or `array[string]` | Name(s) of extensions to install  |
| `options`   | `object`                    | Check below for available options |

#### Options

| Option        | Type      | Description                                                        |
| ------------- | --------- | ------------------------------------------------------------------ |
| `ifNotExists` | `boolean` | Install extension only if it does not exist (default `false`)      |
| `schema`      | `string`  | The name of the schema in which to install the extension's objects |

## Reverse Operation: `dropExtension`

#### `pgm.dropExtension( extension )`

> [!IMPORTANT]
> Un-install postgres extension(s) - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropextension.html)

### Arguments

| Name           | Type                        | Description                       |
| -------------- | --------------------------- | --------------------------------- |
| `extension`    | `string` or `array[string]` | Name(s) of extensions to install  |
| `drop_options` | `object`                    | Check below for available options |

#### Options

| Option     | Type      | Description                       |
| ---------- | --------- | --------------------------------- |
| `ifExists` | `boolean` | Drops extension only if it exists |
| `cascade`  | `boolean` | Drops also dependent objects      |
