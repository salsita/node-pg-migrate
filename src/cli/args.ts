// Canonical (kebab-case) argument names shared between the option definitions
// and the config-resolution pipeline.
//
// These double as the keys looked up inside external config sources (the
// `config` package and `--config-file`), so they must stay kebab-case even
// though commander exposes the parsed values as camelCase.
export const schemaArg = 'schema';
export const createSchemaArg = 'create-schema';
export const databaseUrlVarArg = 'database-url-var';
export const migrationsDirArg = 'migrations-dir';
export const useGlobArg = 'use-glob';
export const migrationsTableArg = 'migrations-table';
export const migrationsSchemaArg = 'migrations-schema';
export const createMigrationsSchemaArg = 'create-migrations-schema';
export const migrationFileLanguageArg = 'migration-file-language';
export const migrationFilenameFormatArg = 'migration-filename-format';
export const templateFileNameArg = 'template-file-name';
export const checkOrderArg = 'check-order';
export const configValueArg = 'config-value';
export const configFileArg = 'config-file';
export const ignorePatternArg = 'ignore-pattern';
export const singleTransactionArg = 'single-transaction';
export const lockArg = 'lock';
export const lockValueArg = 'lock-value';
export const timestampArg = 'timestamp';
export const dryRunArg = 'dry-run';
export const fakeArg = 'fake';
export const decamelizeArg = 'decamelize';
export const prettyArg = 'pretty';
export const verboseArg = 'verbose';
export const rejectUnauthorizedArg = 'reject-unauthorized';
export const envPathArg = 'envPath';
export const advisoryLockModeArg = 'advisory-lock-mode';
export const tsconfigPathsArg = 'tsconfig-paths';
export const forceExitArg = 'force-exit';
