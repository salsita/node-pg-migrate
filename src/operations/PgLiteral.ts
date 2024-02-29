// This is used to create unescaped strings
// exposed in the migrations via pgm.func
export default class PgLiteral {
  static create(str: string): PgLiteral {
    return new PgLiteral(str);
  }

  public readonly literal = true;

  constructor(public readonly value: string) {}

  toString(): string {
    return this.value;
  }
}
