import { createJiti } from "jiti";
import { type MigrationBuilderActions, sqlMigration } from "./sqlMigration";
import { basename, extname } from "node:path";
import { readFile } from "node:fs/promises";

/***
 * Migration loader module.
 * 
 * This module is responsible for loading migrations from the file system, allowing for custom loading behaviours.
 * If no configuration is provided, loading will be performed in a manner that is identical to the classic loading behaviour.
 * 
 * A new SQL migration loading behaviour is available that supports pairing up/down migrations in separate files using up/down 
 * suffixes before the .sql extension.
 * 
 * This has been kept intentionally simple for maintainability and readability reasons.
 * 
 */


/**
 * The jiti instance to use to load migration files.
 */
export const jiti = createJiti(process.cwd());

/*************************
 * Types and interfaces
 *************************/

/**
 * A migration unit is a collection of file paths and related migration actions that are related to a single migration.
 */
export type MigrationUnit = {
  /**
   * The unique identifier for the migration unit. Represents the significant part of the file name.
   * Used for tracking which migrations have been performed.
   */
  id: string;

  /**
   * The file paths that are part of the migration unit.
   */
  filePaths: string[];

  /**
   * The migration builder actions that are contained within the migration files.
   */
  actions: MigrationBuilderActions;
};

/**
 * Loader function type.
 *
 * @param filePaths - The file paths to load migrations from.
 * @returns A list of migration units.
 */
export type MigrationLoader = (filePaths: string[]) => Promise<MigrationUnit[]>;

/**
 * Predefined loader references.
 */
type PredefinedLoader = "default" | "legacySql" | "sql";

/**
 * Configuration extension to support multiple loader strategies.
 */
export interface MigrationLoaderConfig {
  /**
   * Configuration for the migration loader strategies.
   * Strategies are used to load migrations from different sources based on file patterns.
   *
   * If no strategy matches, the default strategy is used.
   */
  migrationLoaderStrategies?: MigrationLoaderStrategy[];
}

/**
 * A migration loader strategy is a configuration object that defines a specific loader for given file extensions.
 */
export interface MigrationLoaderStrategy {
  /**
   * File extensions handled by this strategy.
   */
  extensions: string[];

  /**
   * Loader that handles conversion of file paths to migration units.
   * Can be a loader function, when used as an API,  or a predefined loader when using a json configuration file.
   *
   * @param filePaths - The file paths to load migrations from.
   * @returns The migration units.
   */
  loader: MigrationLoader | PredefinedLoader;
}


/*************************
 * Loader implementations
 *************************/

/**
 * Creates a default migration loader that uses jiti to load migrations from the file paths.
 * @returns The default migration loader.
 */
export function createDefaultMigrationLoader(): MigrationLoader {
  const loader: MigrationLoader = async (filePaths: string[]) => {
    const migrationUnits: MigrationUnit[] = await Promise.all(
      filePaths.map(async (filePath) => {
        const action: MigrationBuilderActions = await jiti.import(filePath);
        return {
          id: filePath,
          filePaths: [filePath],
          actions: action,
        };
      })
    );
    return migrationUnits;
  };
  return loader;
};

/**
 * Creates a legacy SQL migration loader that loads migrations from the file paths using the legacy SQL migration loading behaviour.
 * @returns The legacy SQL migration loader.
 */
export function createLegacySqlMigrationLoader(): MigrationLoader {
  const loader: MigrationLoader = async (filePaths: string[]) => {
    const migrationUnits: MigrationUnit[] = await Promise.all(
      filePaths.map(async (filePath) => {
        const actions = await sqlMigration(filePath);
        return {
          id: filePath,
          filePaths: [filePath],
          actions: actions
        };
      })
    );
    return migrationUnits;
  };
  return loader;
}

/**
 * Creates a SQL migration loader that loads migrations from the file paths using the new SQL migration loading behaviour.
 * While is handles the legacy format, it does add new behaviour that may be unwanted in existing usage so it has been separated from the legacy loader and can be used enabled as needed. 
 * 
 * @returns The SQL migration loader.
 */
export function createSqlMigrationLoader(): MigrationLoader {
  const loader: MigrationLoader = async (filePaths: string[]) => {
    const groups = groupSqlFiles(filePaths);
    const migrationUnits = await Promise.all(groups.map(async (group) => await readSqlFileGroup(group)));
    return migrationUnits;
  };
  return loader;
}


/*************************
 * Loader instances
 *************************/

/**
 * Built-in predefined loaders.
 */
export const builtInLoaders: Record<PredefinedLoader, MigrationLoader> = {
  default: createDefaultMigrationLoader(),
  legacySql: createLegacySqlMigrationLoader(),
  sql: createSqlMigrationLoader(),
};

/**
 * Default migration loader strategies.
 */
const defaultStrategies: MigrationLoaderStrategy[] = [
  { extensions: [".sql"], loader: builtInLoaders.legacySql },
  { extensions: [".js", ".ts"], loader: builtInLoaders.default },
];

/*************************
 * Loader utility functions
 *************************/

/**
 * Resolves the migration loader for a given extension.
 * @param config - The Runner configuration object.
 * @param extension - The extension to resolve the loader for.
 * @returns The migration loader.
 */
function resolveMigrationLoader(config: MigrationLoaderConfig, extension: string): MigrationLoader {

  const normalizedExtension = extension.toLowerCase();
  const strategies = config.migrationLoaderStrategies ?? defaultStrategies;

  const foundStrategy = strategies.find(strategy =>
    strategy.extensions.some(ext => ext.toLowerCase() === normalizedExtension)
  );

  const loader = foundStrategy?.loader ?? builtInLoaders.default;

  if (typeof loader === "string") {
    const resolved = builtInLoaders[loader];
    if (!resolved) {
      throw new Error(`Unknown predefined loader: ${loader}`);
    }
    return resolved;
  }

  return loader;
}

/**
 * Associates the file paths to their extensions.
 * @param filePaths - The file paths to associate.
 * @returns The file paths associated to their extensions.
 */
function associatePathsToExtensions(filePaths: string[]): Map<string, string[]> {
  const filesByExtension = new Map<string, string[]>();
    for (const filePath of filePaths) {
      const ext = extname(filePath).toLowerCase();
      if (!filesByExtension.has(ext)) {
        filesByExtension.set(ext, []);
      }
      filesByExtension.get(ext)!.push(filePath);
    }
  return filesByExtension;
};

/***********************************
 * Migration loader main function
 ***********************************/

/**
 * Loads the migration units from the file paths.
 * @param config - The migration loader configuration.
 * @param filePaths - List of files containing migrations.
 * @returns List of migration units, sorted according to the given file paths.
 */
export async function loadMigrationUnits(config: MigrationLoaderConfig, filePaths: string[]): Promise<MigrationUnit[]> {
  const migrationUnits: MigrationUnit[] = [];
  const filesByExtension = associatePathsToExtensions(filePaths);
  for (const [extension, filePaths] of filesByExtension) {
    const loader = resolveMigrationLoader(config, extension);
    const units = await loader(filePaths);
    migrationUnits.push(...units);
  }
  // Since the sql migration loader modifies the id, it is no longer comparable. Hence we sort by the file path of the first file in the unit that always exists.
  const sortedMigrationUnits = migrationUnits.sort((a, b) => a.filePaths[0]!.localeCompare(b.filePaths[0]!));
  return sortedMigrationUnits;
}

/*****************************************
 * New SQL migration loading behaviour.
 *****************************************/
 
// Helper types

/**
 * A parsed SQL file is a file that has been parsed and contains the id, direction and file path.
 * An intermediate step before the migration unit is created.
 */
type ParsedSqlFile = {
  id: string;
  direction: "up" | "down" | "none";
  filePath: string;
};
/**
 * A SQL group is a group of SQL files associated by significant part of the filename.
 */
type SqlGroup = {
  id: string;
  up?: string;
  down?: string;
  single?: string;
};

/**
 * Parses a SQL file and returns the parsed file.
 * @param filePath - The file path to parse.
 * @returns The parsed file.
 */
function parseSqlFile(filePath: string): ParsedSqlFile {
  const name = basename(filePath, ".sql");

  if (name.endsWith(".up")) {
    return {
      id: name.slice(0, -3),
      direction: "up",
      filePath,
    };
  }

  if (name.endsWith(".down")) {
    return {
      id: name.slice(0, -5),
      direction: "down",
      filePath,
    };
  }

  return {
    id: name,
    direction: "none",
    filePath,
  };
}

/**
 * Groups the SQL files by their significant part of the filename.
 * @param filePaths - The file paths to group.
 * @returns An array of SQL groups.
 * 
 * Throws an error if the files are not properly paired.
 * 
 */
function groupSqlFiles(filePaths: string[]): SqlGroup[] {
  const groups = new Map<string, SqlGroup>();
  for (const filePath of filePaths) {
    const parsed = parseSqlFile(filePath);

    if (!groups.has(parsed.id)) {
      groups.set(parsed.id, {id: parsed.id});
    }

    const group = groups.get(parsed.id)!;

    if (parsed.direction === "up") {
      if (group.up) throw new Error(`Duplicate .up.sql for ${parsed.id}`);
      group.up = parsed.filePath;
    } else if (parsed.direction === "down") {
      if (group.down) throw new Error(`Duplicate .down.sql for ${parsed.id}`);
      group.down = parsed.filePath;
    } else {
      if (group.single) throw new Error(`Duplicate .sql for ${parsed.id}`);
      group.single = parsed.filePath;
    }
  }
  for (const [id, group] of groups) {
    if (group.single && (group.up || group.down)) {
      throw new Error(
        `Conflicting SQL migration files for ${id}: cannot mix .sql with .up/.down`
      );
    }
  
    if (group.down && !group.up) {
      throw new Error(
        `Found .down.sql without matching .up.sql for ${id}`
      );
    }
  }
  return Array.from(groups.values());
}

function sqlGroupId(group: SqlGroup): string {
  let filePath = group.single ?? group.up ?? group.down;
  if (!filePath) {
    throw new Error(`No SQL file found for group ${group.id}`);
  }
  return filePath.replace(/\.up\.sql$/, ".sql")
                 .replace(/\.down\.sql$/, ".sql");
}

/**
 * Performs the actual reading of a SQL file group and returns the migration unit.
 * @param group - The SQL file group to read.
 * @returns The migration unit.
 */
async function readSqlFileGroup(group: SqlGroup): Promise<MigrationUnit> {
  let actions: MigrationBuilderActions

  if (group.single) {
    actions = await sqlMigration(group.single);
  } else {

    if (!group.up) {
      // Since a down migration without an up migration is a deviation from expected behaviour, we throw an error.
      throw new Error(`Missing .up.sql for ${group.id}`);
    }
    const upSql = await readFile(group.up, "utf-8");

    const downSql = group.down ? await readFile(group.down, "utf-8") : undefined;
    actions = {
      up: (pgm) => pgm.sql(upSql),
      down: downSql ? (pgm) => pgm.sql(downSql) : undefined,
      shorthands: {},
    };
  }

  const filePaths = [
    group.up,
    group.down,
    group.single,
  ].filter((p): p is string => Boolean(p));

  return {
    id: sqlGroupId(group),
    filePaths: filePaths,
    actions: actions,
  };
}