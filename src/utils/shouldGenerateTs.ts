import { existsSync, readFileSync } from "fs";
import { globSync } from "glob/raw";

export function shouldGenerateTypescript(): boolean {
  const existsTsConfig = existsSync("./tsconfig.json");

  const hasTypeScriptFiles =
    globSync("**/*.ts", {
      cwd: process.cwd(),
      ignore: ["**/node_modules/**", "**/dist/**"],
    }).length > 0;

  const allowsJsInTsConfig =
    existsTsConfig &&
    (() => {
      const pureFile = readFileSync("./tsconfig.json", "utf-8");

      const refined = pureFile.replace(
        /\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g,
        (m, g) => (g ? "" : m),
      );

      const tsConfig = JSON.parse(refined);

      return tsConfig.compilerOptions?.allowJs ?? false;
    })();

  const isNoNeedTsConfig = !existsTsConfig && hasTypeScriptFiles;

  const tsConfigHasImpact = existsTsConfig && !allowsJsInTsConfig;

  return tsConfigHasImpact || isNoNeedTsConfig;
}
