# Change Log

## [5.9.0](2020-11-04)

### Added

- Allow expanding dotenv with dotenv-expand [#712](https://github.com/salsita/node-pg-migrate/pull/712)

## [5.8.1](2020-10-12)

### Fixed

- Fix sequence generated [#706](https://github.com/salsita/node-pg-migrate/pull/706)

## [5.8.0](2020-09-24)

### Fixed

- Using string ids for Dollar-string escaping [#698](https://github.com/salsita/node-pg-migrate/pull/698)

## [5.7.1](2020-09-22)

### Fixed

- Handle string params in backward compatible way [#696](https://github.com/salsita/node-pg-migrate/pull/696)

## [5.7.0](2020-09-21)

### Added

- `pgm.sql` can also accept `PgLiteral`, `number`, `boolean`, `null`, `array` [#695](https://github.com/salsita/node-pg-migrate/pull/695)

## [5.6.0](2020-08-19)

### Added

- PgLiteral can be serialized [#678](https://github.com/salsita/node-pg-migrate/pull/678)

## [5.5.1](2020-08-18)

### Fixed

- Do not try to unlock DB if connection failed [#677](https://github.com/salsita/node-pg-migrate/pull/677)

## [5.5.0](2020-08-10)

### Changed

- Allow opclass and sort per column in indexes [#671](https://github.com/salsita/node-pg-migrate/pull/671)

## [5.4.0](2020-08-05)

### Changed

- Update isExternalClient check [#664](https://github.com/salsita/node-pg-migrate/pull/664)

## [5.3.0](2020-07-13)

### Added

- Display additional details when logging errors [#660](https://github.com/salsita/node-pg-migrate/pull/660)

## [5.2.0](2020-06-26)

### Added

- View options [#656](https://github.com/salsita/node-pg-migrate/pull/656)

## [5.1.1](2020-06-08)

### Fixed

- Fix creating migration [#646](https://github.com/salsita/node-pg-migrate/pull/646)

## [5.1.0](2020-06-05)

### Added

- Ability to specify own template file [#642](https://github.com/salsita/node-pg-migrate/pull/642)

## [5.0.2](2020-06-05)

### Fixed

- Fix alter column collation [#641](https://github.com/salsita/node-pg-migrate/pull/641)

## [5.0.1](2020-06-02)

### Fixed

- Keep `this` bind in logger methods [#638](https://github.com/salsita/node-pg-migrate/pull/638)

## [5.0.0](2020-05-19)

### Breaking changes

- remove node 8 support [#615](https://github.com/salsita/node-pg-migrate/pull/615)
- Ability to use sort of UTC time in filename [#622](https://github.com/salsita/node-pg-migrate/pull/622)

  If you used a different format for migrations names than the default one it can potentially break the order of your migrations

- Migration can be also symlink [#630](https://github.com/salsita/node-pg-migrate/pull/630)

  If you have symlinks in the migration folder, migration can potentially break

### Fixed

- Fixed position of TEMPORARY clause in create table [#629](https://github.com/salsita/node-pg-migrate/pull/629)

## [4.8.0](2020-05-04)

### Aded

- add DB env var and tsconfig path to config options [#613](https://github.com/salsita/node-pg-migrate/pull/613)

## [4.7.0](2020-04-29)

### Aded

- Export ColumnDefinition [#611](https://github.com/salsita/node-pg-migrate/pull/611)
- feat: support for parsing `tsconfig.json` with comments [#606](https://github.com/salsita/node-pg-migrate/pull/606)

### Fixed

- pipe return writeable, should use close event [#608](https://github.com/salsita/node-pg-migrate/pull/608)

## [4.6.2](2020-04-23)

### Fixed

- Fixing default options [#601](https://github.com/salsita/node-pg-migrate/pull/601)

## [4.6.1](2020-04-08)

### Fixed

- Accepting Pool Client [#596](https://github.com/salsita/node-pg-migrate/pull/596)

## [4.6.0](2020-04-07)

### Added

- `reject-unauthorized` CLI option [#594](https://github.com/salsita/node-pg-migrate/pull/594)

## [4.5.1](2020-04-03)

### Fixed

- Do provide default cli option value only if not specified [#588](https://github.com/salsita/node-pg-migrate/pull/588)
- Fix locking [#586](https://github.com/salsita/node-pg-migrate/pull/586)

## [4.5.0](2020-04-01)

### Added

- Command line arguments should override config ones [#585](https://github.com/salsita/node-pg-migrate/pull/585)

## [4.4.0](2020-03-31)

### Added

- Support for pg v8 [#584](https://github.com/salsita/node-pg-migrate/pull/584)

## [4.3.0](2020-03-30)

### Added

- Possibility to pass custom logger [#580](https://github.com/salsita/node-pg-migrate/pull/580)
- Ability to switch off debug logging [#581](https://github.com/salsita/node-pg-migrate/pull/581)

## [4.2.3](2020-03-17)

Release with updated dependencies

## [4.2.2](2020-01-20)

### Fixed

- Escape BEFORE and AFTER in addTypeValue [#554](https://github.com/salsita/node-pg-migrate/pull/554)

## [4.2.1](2020-01-07)

### Fixed

- Fixing typing of createTrigger parameters [#548](https://github.com/salsita/node-pg-migrate/pull/548)

## [4.2.0](2019-12-19)

### Added

- Adding include option for createIndex [#537](https://github.com/salsita/node-pg-migrate/pull/537)

## [4.1.0](2019-12-13)

### Added

- Expression generated columns [#532](https://github.com/salsita/node-pg-migrate/pull/532)

## [4.0.0](2019-12-12)

## [4.0.0-rc2](2019-12-11)

### Added

- Allow 'Down' migrations in .sql files [#530](https://github.com/salsita/node-pg-migrate/pull/530)

## [4.0.0-rc1](2019-12-02)

### Breaking changes

- Drop old node support [#526](https://github.com/salsita/node-pg-migrate/pull/526)

## [4.0.0-rc](2019-12-02)

Rewrite in typescript

### Breaking changes

- Removed optional dependencies [#509](https://github.com/salsita/node-pg-migrate/pull/509)

  If you are using `config` or `dotenv` configuration, it is no longer installed as optional dependency. You have to provide this package yourself.

- Write node-pg-migrate in TypeScript
  [#502](https://github.com/salsita/node-pg-migrate/pull/502)
  [#510](https://github.com/salsita/node-pg-migrate/pull/510)
  [#515](https://github.com/salsita/node-pg-migrate/pull/515)
  [#516](https://github.com/salsita/node-pg-migrate/pull/516)
  [#519](https://github.com/salsita/node-pg-migrate/pull/519)
  [#520](https://github.com/salsita/node-pg-migrate/pull/520)
  [#523](https://github.com/salsita/node-pg-migrate/pull/523)

  - Fixed some issues with types which did not correspond to how code behave.
  - `functionArgs` in trigger options renamed to `functionParams` because of consistency.

- Support for TS migrations [#521](https://github.com/salsita/node-pg-migrate/pull/521)

### Added

- Improve error message in migration.js [#506](https://github.com/salsita/node-pg-migrate/pull/506)
- Another way for transpiling TypeScript [#522](https://github.com/salsita/node-pg-migrate/pull/522)

### Fixes

- Updates to docs - specifying schema for trigger_name [#505](https://github.com/salsita/node-pg-migrate/pull/505)
- createIndex doc [#524](https://github.com/salsita/node-pg-migrate/pull/524)

## [3.23.3](2019-10-10)

### Fixed

- Fixing `createTrigger` TS type [#494](https://github.com/salsita/node-pg-migrate/pull/494)

## [3.23.2](2019-10-03)

### Fixed

- Marking `storageParameters` of materialized view as optional [#490](https://github.com/salsita/node-pg-migrate/pull/490)

## [3.23.1](2019-09-25)

### Fixed

- Fixing constraint name not optional [#486](https://github.com/salsita/node-pg-migrate/pull/486)

## [3.23.0](2019-09-17)

### Added

- Decamelize (experimental - it may happen some names are not decamelized) [#472](https://github.com/salsita/node-pg-migrate/pull/472)

## [3.22.1](2019-09-12)

### Fixed

- Fix create constraint by string [#482](https://github.com/salsita/node-pg-migrate/pull/482)

## [3.22.0](2019-08-19)

### Added

- Multiple schemas [#475](https://github.com/salsita/node-pg-migrate/pull/475)
- Constraints - naming and comments [#474](https://github.com/salsita/node-pg-migrate/pull/474)
- Update template files [#473](https://github.com/salsita/node-pg-migrate/pull/473)
- Tests for passwords [#440](https://github.com/salsita/node-pg-migrate/pull/440), [#441](https://github.com/salsita/node-pg-migrate/pull/441), [#442](https://github.com/salsita/node-pg-migrate/pull/442)

## [3.21.1](2019-05-28)

### Fixed

- Drop index when schema and index name is specified [#437](https://github.com/salsita/node-pg-migrate/pull/437)

## [3.21.0](2019-05-27)

### Added

- Implement LiteralUnion for Extension [#434](https://github.com/salsita/node-pg-migrate/pull/434)

## [3.20.0](2019-05-06)

### Added

- Add ifNotExists to addColumns [#427](https://github.com/salsita/node-pg-migrate/pull/427)

## [3.19.0](2019-04-30)

### Added

- Generated option for column [#426](https://github.com/salsita/node-pg-migrate/pull/426)
- Testing node version 6,8,10,12, postgres 9,10,11, cockroach 1,2 [#423](https://github.com/salsita/node-pg-migrate/pull/423)

## [3.18.1](2019-03-13)

### Fixed

- Do not use alias function name [#414](https://github.com/salsita/node-pg-migrate/pull/414)

## [3.18.0](2019-03-07)

### Added

- Returning list of run migrations [#411](https://github.com/salsita/node-pg-migrate/pull/411)

## [3.17.0](2019-03-05)

### Added

- Allow user to specify multiple check constraints when creating table [#408](https://github.com/salsita/node-pg-migrate/pull/408)
- Allow user to pass db client to migration runner [#407](https://github.com/salsita/node-pg-migrate/pull/407)

## [3.16.1](2019-02-25)

### Fixed

- Fix empty migration files [#400](https://github.com/salsita/node-pg-migrate/pull/400)

## [3.16.0](2019-02-08)

### Added

- Adding LIKE options when creating table [#394](https://github.com/salsita/node-pg-migrate/pull/394)

## [3.15.0](2019-01-28)

### Added

- Infering migration language [#391](https://github.com/salsita/node-pg-migrate/pull/391)

## [3.14.2](2018-12-04)

### Fixed

- Exporting PgType [#368](https://github.com/salsita/node-pg-migrate/pull/368)

## [3.14.1](2018-11-30)

### Fixed

- Pass all params to pg query [#361](https://github.com/salsita/node-pg-migrate/pull/361)

## [3.14.0](2018-11-14)

### Changed

- Add ForeignKey Reference Action [#357](https://github.com/salsita/node-pg-migrate/pull/357)

## [3.13.0](2018-11-02)

### Changed

- Better migration name fix [#353](https://github.com/salsita/node-pg-migrate/pull/353)
- Fix migration name substitution [#348](https://github.com/salsita/node-pg-migrate/pull/348)

## [3.12.0](2018-10-24)

### Added

- Shorthand can reference other shorthands [#346](https://github.com/salsita/node-pg-migrate/pull/346)

## [3.11.0](2018-09-11)

### Added

- Ability to mark migrations as run [#324](https://github.com/salsita/node-pg-migrate/pull/324)

## [3.10.1](2018-09-05)

### Fixed

- Fix dropping index in another schema [#322](https://github.com/salsita/node-pg-migrate/pull/322)

## [3.10.0](2018-09-02)

### Changed

- Using default libpq env vars [#319](https://github.com/salsita/node-pg-migrate/pull/319)

## [3.9.0](2018-08-23)

### Changed

- Do not construct connection string [#316](https://github.com/salsita/node-pg-migrate/pull/316)

# Change Log

## [3.8.1](2018-07-23)

### Changed

- Removing default value for parallel clause [#308](https://github.com/salsita/node-pg-migrate/pull/308)

### Fixed

- Fix JSON quotes for script [#307](https://github.com/salsita/node-pg-migrate/pull/307)

## [3.8.0](2018-07-20)

### Added

- Ignoring dotfiles by default [#305](https://github.com/salsita/node-pg-migrate/pull/305)
- Encoding special characters in db config [#304](https://github.com/salsita/node-pg-migrate/pull/304)

## [3.7.0](2018-07-12)

### Added

- Renaming of enum values [#293](https://github.com/salsita/node-pg-migrate/pull/293)

## [3.6.1](2018-07-09)

### Fixed

- Workaround for transpilers [#299](https://github.com/salsita/node-pg-migrate/pull/299)
- Interface for references [#297](https://github.com/salsita/node-pg-migrate/pull/297)

### Changed

- Updates to installation and licence [#298](https://github.com/salsita/node-pg-migrate/pull/298)
- Update readme [#296](https://github.com/salsita/node-pg-migrate/pull/296)

## [3.6.0](2018-06-29)

### Fixed

- Ability to name references constraint [#290](https://github.com/salsita/node-pg-migrate/pull/290)
- Alter column comment [#292](https://github.com/salsita/node-pg-migrate/pull/292)

### Changed

- Update dependencies to enable Greenkeeper [#278](https://github.com/salsita/node-pg-migrate/pull/278)
- Update CI config [#281](https://github.com/salsita/node-pg-migrate/pull/281)
- Using async/await [#282](https://github.com/salsita/node-pg-migrate/pull/282)
- Using 'function' keyword [#283](https://github.com/salsita/node-pg-migrate/pull/283)
- Using code directly for node >= 8 [#288](https://github.com/salsita/node-pg-migrate/pull/288)
- Added cockroach v2 to tests [#289](https://github.com/salsita/node-pg-migrate/pull/289)
- Using tests without babel [#291](https://github.com/salsita/node-pg-migrate/pull/291)

## [3.5.1](2018-06-20)

### Fixed

- Respect configured logger [#277](https://github.com/salsita/node-pg-migrate/pull/277)

## [3.5.0](2018-06-06)

### Fixed

- Added id column to order by clause of select migrations [#272](https://github.com/salsita/node-pg-migrate/pull/272)

### Added

- Adding primary key on pgmigrations table [#274](https://github.com/salsita/node-pg-migrate/pull/274)

## [3.4.1](2018-06-06)

### Fixed

- opclass parens typo [#270](https://github.com/salsita/node-pg-migrate/pull/270)

## [3.4.0](2018-06-05)

### Changed

- Constraint name is optional (for backward compatibility) [#268](https://github.com/salsita/node-pg-migrate/pull/268)
- Updated node and service versions [#269](https://github.com/salsita/node-pg-migrate/pull/269)

!!! Minimal supported node version is now 6 !!!

## [3.3.0](2018-05-21)

### Fixed

- Promisifying client.connect [#265](https://github.com/salsita/node-pg-migrate/pull/265)

## [3.2.1](2018-05-21)

### Fixed

- Fix type name issue when the type is not in the default schema [#264](https://github.com/salsita/node-pg-migrate/pull/264)

## [3.2.0](2018-05-17)

### Added

- Add support for opclass option in createIndex [#259](https://github.com/salsita/node-pg-migrate/pull/259)
- Ability to specify extension schema [#260](https://github.com/salsita/node-pg-migrate/pull/260)

## [3.1.2](2018-05-14)

### Fixed

- Using dollar-quoted strings in comments [#255](https://github.com/salsita/node-pg-migrate/pull/255)

## [3.1.1](2018-05-02)

### Fixed

- Fixing optional options in create and drop statements [#250](https://github.com/salsita/node-pg-migrate/pull/250)

## [3.1.0](2018-04-19)

### Added

- Handling SQL files [#246](https://github.com/salsita/node-pg-migrate/pull/246)

## [3.0.0](2018-04-12)

## [3.0.0-rc5](2018-04-06)

### Fixed

- Fix comment not being optional [#244](https://github.com/salsita/node-pg-migrate/pull/244)
- Fix behavior when singleTransaction is not set [#245](https://github.com/salsita/node-pg-migrate/pull/245)

## [3.0.0-rc4](2018-04-03)

### Changed

- Implement failsafe locking [#239](https://github.com/salsita/node-pg-migrate/pull/239)
- Updated docs about locking [#240](https://github.com/salsita/node-pg-migrate/pull/240)

## [3.0.0-rc3](2018-04-03)

### Added

- Add log option to runner.js [#238](https://github.com/salsita/node-pg-migrate/pull/238)
- Structuring docs [#237](https://github.com/salsita/node-pg-migrate/pull/237)
- Prettier formatting [#236](https://github.com/salsita/node-pg-migrate/pull/236)
- Displaying function name on infer failure [#235](https://github.com/salsita/node-pg-migrate/pull/235)
- Materialized views handling [#234](https://github.com/salsita/node-pg-migrate/pull/234)
- Handling Views [#233](https://github.com/salsita/node-pg-migrate/pull/233)
- Cockroach test [#231](https://github.com/salsita/node-pg-migrate/pull/231)
- Prettier [#230](https://github.com/salsita/node-pg-migrate/pull/230)

## [3.0.0-rc2](2018-03-26)

### Fixed

- Fixing setting comments on columns [#228](https://github.com/salsita/node-pg-migrate/pull/228)

## [2.26.3](2018-03-26)

### Fixed

- Fixing setting comments on columns [#228](https://github.com/salsita/node-pg-migrate/pull/228)

# [3.0.0-rc](2018-03-23)

### Breaking changes

- Single transaction as default [#205](https://github.com/salsita/node-pg-migrate/pull/205)
- Versioning type shorthands [#190](https://github.com/salsita/node-pg-migrate/pull/190)
  (type shorthands were moved from global config to migrations scripts)
- Using camel case in API [#189](https://github.com/salsita/node-pg-migrate/pull/189)
- Removed `pg-migrate` script
  (use `node-pg-migrate`)

### Added

- Running test migrations on CircleCI [#221](https://github.com/salsita/node-pg-migrate/pull/221)

## [2.26.2](2018-03-23)

### Fixed

- Fix runner for zero migrations [#224](https://github.com/salsita/node-pg-migrate/pull/224)

## [2.26.1](2018-03-23)

### Fixed

- Fixing altering role [#222](https://github.com/salsita/node-pg-migrate/pull/222)
- Fixes from 3.0 [#223](https://github.com/salsita/node-pg-migrate/pull/223)

## [2.26.0](2018-03-16)

### Added

- Support for policies [#219](https://github.com/salsita/node-pg-migrate/pull/219)

## [2.25.1](2018-03-16)

### Fixed

- Role inherit fix [#218](https://github.com/salsita/node-pg-migrate/pull/218)

## [2.25.0](2018-03-08)

### Fixed

- (No)Transaction handling [#213](https://github.com/salsita/node-pg-migrate/pull/213)
- Parens around INHERITS clause [#214](https://github.com/salsita/node-pg-migrate/pull/214)

### Added

- Exposing DB [#212](https://github.com/salsita/node-pg-migrate/pull/212)

## [2.24.1](2018-03-05)

### Fixed

- Fix auto create schema [#206](https://github.com/salsita/node-pg-migrate/pull/206)

## [2.24.0](2018-03-01)

### Added

- Add `--single-transaction` option [#204](https://github.com/salsita/node-pg-migrate/pull/204)

## [2.23.1](2018-02-21)

### Fixed

- Correct handling of multiline constraints [#202](https://github.com/salsita/node-pg-migrate/pull/202)

## [2.23.0](2018-02-20)

### Changed

- Updating deps, removing vulnerablity status for peer and optional dependencies [#199](https://github.com/salsita/node-pg-migrate/pull/199)
- Removing regex [#198](https://github.com/salsita/node-pg-migrate/pull/198)
- Adding ability to specify database name with 'database' option [#197](https://github.com/salsita/node-pg-migrate/pull/197)

## [2.22.2](2018-02-20)

### Fixed

- Role encrypted default [#196](https://github.com/salsita/node-pg-migrate/pull/196)
- Running queries in order [#195](https://github.com/salsita/node-pg-migrate/pull/195)

## [2.22.1](2018-02-20)

### Fixed

- Passing props [#194](https://github.com/salsita/node-pg-migrate/pull/194)

## [2.22.0](2018-02-20)

### Added

- Auto create configured schemas if they don't exist [#192](https://github.com/salsita/node-pg-migrate/pull/192)
- Add ifNotExists option to create extension [#188](https://github.com/salsita/node-pg-migrate/pull/188)
- Programmatic API docs [#187](https://github.com/salsita/node-pg-migrate/pull/187)

## [2.21.0](2018-02-12)

### Added

- Table and column comments [#183](https://github.com/salsita/node-pg-migrate/pull/183)

## [2.19.0](2018-02-06)

### Added

- `migration-file-language` can be set in config file [#180](https://github.com/salsita/node-pg-migrate/pull/180)
- Treat number argument to up/down migration as timestamp [#179](https://github.com/salsita/node-pg-migrate/pull/179)

## [2.18.1](2018-02-06)

### Fixed

- Fixing addConstraint method with object expression [#176](https://github.com/salsita/node-pg-migrate/pull/176)

## [2.18.0](2018-02-05)

### Added

- Add no lock option [#171](https://github.com/salsita/node-pg-migrate/pull/171)
- Updated docs [#174](https://github.com/salsita/node-pg-migrate/pull/174)

### Changed

- Remove old version number from index.d.ts [#173](https://github.com/salsita/node-pg-migrate/pull/173)
- Remove default match in column reference [#172](https://github.com/salsita/node-pg-migrate/pull/172)
- Refactor code to use camel casing [#167](https://github.com/salsita/node-pg-migrate/pull/167)

## [2.17.0](2018-01-26)

### Added

- Added typescript migration template [#165](https://github.com/salsita/node-pg-migrate/pull/165)
- Updated type definitions to accept db client config [#166](https://github.com/salsita/node-pg-migrate/pull/166)

## [2.16.2](2018-01-25)

### Fixed

- Deleted duplicate declaration [#164](https://github.com/salsita/node-pg-migrate/pull/164)

## [2.16.1](2018-01-25)

### Changed

- Updated dependencies [#158](https://github.com/salsita/node-pg-migrate/pull/158)

### Fixed

- Typescript definition fixes [#162](https://github.com/salsita/node-pg-migrate/pull/162)

## [2.16.0](2018-01-23)

### Added

- Uniting drop statements [#154](https://github.com/salsita/node-pg-migrate/pull/154)
- Handling domains [#155](https://github.com/salsita/node-pg-migrate/pull/155)
- Operator operations [#156](https://github.com/salsita/node-pg-migrate/pull/156)
- Sequences operations [#157](https://github.com/salsita/node-pg-migrate/pull/157)

## [2.15.0](2018-01-11)

### Fixed

- Handle rejections in migration actions [#148](https://github.com/salsita/node-pg-migrate/pull/148)

### Added

- TypeScript declaration file [#147](https://github.com/salsita/node-pg-migrate/pull/147) [#150](https://github.com/salsita/node-pg-migrate/pull/150)

## [2.14.0](2017-11-14)

### Added

- Deferrable column constraints [#139](https://github.com/salsita/node-pg-migrate/pull/139)
- Possibility to use function in multi-column index [#140](https://github.com/salsita/node-pg-migrate/pull/140)

### Changed

- Changed all references from pg-migrate to node-pg-migrate [#141](https://github.com/salsita/node-pg-migrate/pull/141)

  !!! Breaking change from version 3 !!! (now with warning)

## [2.13.2](2017-11-03)

### Fixed

- Cannot use embedded value in config [#137](https://github.com/salsita/node-pg-migrate/pull/137)
- add space before `USING` keyword [#138](https://github.com/salsita/node-pg-migrate/pull/138)

## [2.13.1](2017-10-23)

### Fixed

- addTypeValue's `after` option is using BEFORE instead of AFTER [#133](https://github.com/salsita/node-pg-migrate/pull/133)

## [2.13.0](2017-10-12)

### Added

- Ability to specify files to ignore in migrations directory [#131](https://github.com/salsita/node-pg-migrate/pull/131)

## [2.12.0](2017-10-09)

### Fixed

- Dollar quoted string constants [#127](https://github.com/salsita/node-pg-migrate/pull/127)
- Table unique constraint can be array of arrays [#126](https://github.com/salsita/node-pg-migrate/pull/126)

### Changed

- If user disables migration, return Error instead of string [#125](https://github.com/salsita/node-pg-migrate/pull/125)
- Circle CI integration [#124](https://github.com/salsita/node-pg-migrate/pull/124)
- Moved to Salsita organization [#122](https://github.com/salsita/node-pg-migrate/pull/122)

## [2.11.1](2017-09-26)

### Fixed

- Fixed SQL for dropping multiple columns [#120](https://github.com/salsita/node-pg-migrate/pull/120)

## [2.11.0](2017-09-25)

### Added

- Schemas operations [#119](https://github.com/salsita/node-pg-migrate/pull/119)

## [2.10.1](2017-09-25)

### Fixed

- Fixed invalid SQL for table level foreign key [#118](https://github.com/salsita/node-pg-migrate/pull/118)

## [2.10.0](2017-09-21)

### Added

- Ability to specify constraints on table level [#114](https://github.com/salsita/node-pg-migrate/pull/114)

## [2.9.0](2017-09-12)

### Added

- Alter type functions [#111](https://github.com/salsita/node-pg-migrate/pull/111)
- redo command [#112](https://github.com/salsita/node-pg-migrate/pull/112)

## [2.8.2](2017-09-11)

### Fixed

- Fix automatic reversal of addColumns [#110](https://github.com/salsita/node-pg-migrate/pull/110)

## [2.8.1](2017-09-06)

### Fixed

- Fixing referencing column [#107](https://github.com/salsita/node-pg-migrate/pull/107)

### Changed

- Formatting changes, added licence [#108](https://github.com/salsita/node-pg-migrate/pull/108)

## [2.8.0](2017-09-04)

### Added

- Trigger operations [#104](https://github.com/salsita/node-pg-migrate/pull/104)

## [2.7.1](2017-08-28)

### Fixed

- Support object with schema and table name in more places [#105](https://github.com/salsita/node-pg-migrate/pull/105)

## [2.7.0](2017-08-01)

### Added

- Function operations [#103](https://github.com/salsita/node-pg-migrate/pull/103)

## [2.6.0](2017-07-20)

### Added

- Support for pg >=4.3.0 <8.0.0
- Interpret only files as migrations in migration directory [#101](https://github.com/salsita/node-pg-migrate/pull/101)

## [2.5.0](2017-07-19)

### Added

- USING clause in alter column [#99](https://github.com/salsita/node-pg-migrate/pull/99)
- Role operations [#100](https://github.com/salsita/node-pg-migrate/pull/100)

## [2.4.0](2017-07-17)

### Changed

- Do not check file extension of migration file [#93](https://github.com/salsita/node-pg-migrate/pull/93)

## [2.3.0](2017-06-20)

### Added

- JSON config and type shorthands [see](README.md#json-configuration) [#91](https://github.com/salsita/node-pg-migrate/pull/91)

## [2.2.1](2017-05-26)

### Fixed

- Syntax error in node 4

## [2.2.0](2017-05-25)

### Added

- Better error logging [#86](https://github.com/salsita/node-pg-migrate/pull/86)
- Locking migrations [#88](https://github.com/salsita/node-pg-migrate/pull/88)
- Updated docs [#89](https://github.com/salsita/node-pg-migrate/pull/89)

## [2.1.1](2017-05-18)

### Fixed

- Down migration when down method is inferred [#84](https://github.com/salsita/node-pg-migrate/pull/84)

## [2.1.0](2017-05-10)

### Added

- Enable string functions and arrays as default column values [#82](https://github.com/salsita/node-pg-migrate/pull/82)

## [2.0.0](2017-04-28)

Rewritten using es6 (transpiled via [babel](https://babeljs.io/)) and Promises.

### Breaking Changes

- supports only node >= 4
- `check-order` flag now defaults to `true` (to switch it off supply `--no-check-order` on command line)
- [dotenv](https://www.npmjs.com/package/dotenv) package is `optionalDependency`
- `s` option is now alias for `schema` which sets schema for migrations SQL, if you only need to change schema of migrations table use `--migrations-schema`

### Added

- [config](https://www.npmjs.com/package/config) package as `optionalDependency`
- Migration can return `Promise`
