# Change Log

## [2.11.1] (2017-09-26)

### Fixed

- Fixed SQL for dropping multiple columns [#120](https://github.com/theoephraim/node-pg-migrate/pull/120)

## [2.11.0] (2017-09-25)

### Added

- Schemas operations [#119](https://github.com/theoephraim/node-pg-migrate/pull/119)

## [2.10.1] (2017-09-25)

### Fixed

- Fixed invalid SQL for table level foreign key [#118](https://github.com/theoephraim/node-pg-migrate/pull/118)

## [2.10.0] (2017-09-21)

### Added

- Ability to specify constraints on table level [#114](https://github.com/theoephraim/node-pg-migrate/pull/114)

## [2.9.0] (2017-09-12)

### Added

- Alter type functions [#111](https://github.com/theoephraim/node-pg-migrate/pull/111)
- redo command [#112](https://github.com/theoephraim/node-pg-migrate/pull/112)

## [2.8.2] (2017-09-11)

### Fixed

- Fix automatic reversal of addColumns [#110](https://github.com/theoephraim/node-pg-migrate/pull/110)

## [2.8.1] (2017-09-06)

### Fixed

- Fixing referencing column [#107](https://github.com/theoephraim/node-pg-migrate/pull/107)

### Changed

- Formatting changes, added licence [#108](https://github.com/theoephraim/node-pg-migrate/pull/108)

## [2.8.0] (2017-09-04)

### Added

- Trigger operations [#104](https://github.com/theoephraim/node-pg-migrate/pull/104)

## [2.7.1] (2017-08-28)

### Fixed

- Support object with schema and table name in more places [#105](https://github.com/theoephraim/node-pg-migrate/pull/105)

## [2.7.0] (2017-08-01)

### Added

- Function operations [#103](https://github.com/theoephraim/node-pg-migrate/pull/103)

## [2.6.0] (2017-07-20)

### Added

- Support for pg >=4.3.0 <8.0.0
- Interpret only files as migrations in migration directory [#101](https://github.com/theoephraim/node-pg-migrate/pull/101)

## [2.5.0] (2017-07-19)

### Added

- USING clause in alter column [#99](https://github.com/theoephraim/node-pg-migrate/pull/99)
- Role operations [#100](https://github.com/theoephraim/node-pg-migrate/pull/100)

## [2.4.0] (2017-07-17)

### Changed

- Do not check file extension of migration file [#93](https://github.com/theoephraim/node-pg-migrate/pull/93)

## [2.3.0] (2017-06-20)

### Added

- JSON config and type shorthands [see](README.md#json-configuration) [#91](https://github.com/theoephraim/node-pg-migrate/pull/91)

## [2.2.1] (2017-05-26)

### Fixed

- Syntax error in node 4

## [2.2.0] (2017-05-25)

### Added

- Better error logging [#86](https://github.com/theoephraim/node-pg-migrate/pull/86)
- Locking migrations [#88](https://github.com/theoephraim/node-pg-migrate/pull/88)
- Updated docs [#89](https://github.com/theoephraim/node-pg-migrate/pull/89)

## [2.1.1] (2017-05-18)

### Fixed

- Down migration when down method is inferred [#84](https://github.com/theoephraim/node-pg-migrate/pull/84)

## [2.1.0] (2017-05-10)

### Added

- Enable string functions and arrays as default column values [#82](https://github.com/theoephraim/node-pg-migrate/pull/82)

## [2.0.0] (2017-04-28)

Rewritten using es6 (transpiled via [babel](https://babeljs.io/)) and Promises.

### Breaking Changes

- supports only node >= 4
- `check-order` flag now defaults to `true` (to switch it off supply `--no-check-order` on command line)
- [dotenv](https://www.npmjs.com/package/dotenv) package is `optionalDependency`
- `s` option is now alias for `schema` which sets schema for migrations SQL, if you only need to change schema of migrations table use `--migrations-schema`

### Added

- [config](https://www.npmjs.com/package/config) package as `optionalDependency`
- Migration can return `Promise`
