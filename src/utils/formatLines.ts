export function formatLines(
  lines: ReadonlyArray<string>,
  replace = '  ',
  separator = ',',
  pretty = false
): string {
  const collapsed = lines.map((line) => line.replace(/(?:\r\n|\r|\n)+/g, ' '));

  if (pretty) {
    return collapsed.join(`${separator}\n`).replace(/^/gm, replace);
  }

  // Single-line output: drop the leading indentation of the prefix but keep
  // any semantic keyword it carries (e.g. `ADD `, `ALTER "col" `).
  const prefix = replace.replace(/^[^\S\r\n]+/, '');

  return collapsed.map((line) => `${prefix}${line}`).join(`${separator} `);
}
