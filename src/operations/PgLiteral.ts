// This is used to create unescaped strings
// exposed in the migrations via pgm.func
export default class PgLiteral {
  static create(str: string): PgLiteral {
    return new PgLiteral(str)
  }

  private readonly _str: string

  constructor(str: string) {
    this._str = str
  }

  toString(): string {
    return this._str
  }
}
