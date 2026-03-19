export function localeCompareStringsNumerically(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    usage: 'sort',
    numeric: true,
    sensitivity: 'variant',
    ignorePunctuation: true,
  });
}
