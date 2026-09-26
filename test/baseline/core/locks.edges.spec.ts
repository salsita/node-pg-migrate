import { describe, expect, it } from 'vitest';
import { requiredMaxLocksPerTransaction } from '../../../src/baseline/core/locks';

describe('requiredMaxLocksPerTransaction', () => {
  it('counts at least one slot of the lock table', () => {
    expect(requiredMaxLocksPerTransaction(512, 0, 0)).toBe(640);
    expect(requiredMaxLocksPerTransaction(512, 1, 0)).toBe(640);
  });

  it('gives exact results at the multiples of 64', () => {
    expect(requiredMaxLocksPerTransaction(1_000_000 * 64, 1_250_000, 0)).toBe(
      64
    );
    expect(requiredMaxLocksPerTransaction(1_000_001 * 64, 1_250_000, 0)).toBe(
      128
    );
  });
});
