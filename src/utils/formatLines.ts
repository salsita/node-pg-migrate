export function formatLines(
  lines: ReadonlyArray<string>,
  replace = '  ',
  separator = ','
): string {
  return lines
    .map((line) => line.replace(/(?:\r\n|\r|\n)+/g, ' '))
    .join(`${separator}\n`)
    .replace(/^/gm, replace);
}
