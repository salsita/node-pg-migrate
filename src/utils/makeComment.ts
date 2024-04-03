import { escapeValue } from '.';

export function makeComment(
  object: string,
  name: string,
  text?: string | null
): string {
  const cmt = escapeValue(text || null);

  return `COMMENT ON ${object} ${name} IS ${cmt};`;
}
