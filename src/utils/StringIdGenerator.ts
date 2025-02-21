// TODO @Shinigami92 2024-04-03: Can this be fully rewritten to a generator function?

// credits to https://stackoverflow.com/a/12504061/4790644
export class StringIdGenerator {
  private readonly chars: string;

  private ids: number[] = [0];

  constructor(chars = 'abcdefghijklmnopqrstuvwxyz') {
    this.chars = chars;
  }

  next(): string {
    const idsChars = this.ids.map((id) => this.chars[id]);
    this.increment();
    return idsChars.join('');
  }

  private increment(): void {
    for (let i = this.ids.length - 1; i >= 0; i -= 1) {
      this.ids[i] += 1;
      if (this.ids[i] < this.chars.length) {
        return;
      }

      this.ids[i] = 0;
    }

    this.ids.unshift(0);
  }
}
