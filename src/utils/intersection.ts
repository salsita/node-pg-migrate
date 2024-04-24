export function intersection<T>(list1: T[], list2: T[]): T[] {
  return list1.filter((element) => list2.includes(element));
}
