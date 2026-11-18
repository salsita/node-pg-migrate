import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_LOCKS_PER_TRANSACTION,
  estimateRelations,
  requiredMaxLocksPerTransaction,
} from '../../../src/baseline/core/locks';
import type { DumpStats } from '../../../src/baseline/types';

const NOTHING: DumpStats = {
  tables: 0,
  indexes: 0,
  indexBackedConstraints: 0,
  sequences: 0,
  views: 0,
  materializedViews: 0,
};

/**
 * What `pg_dump` finds in the 5,000-table stress schema of
 * `test/fixtures/generate.ts`: per table an identity sequence, a primary key
 * and a unique constraint, two more indexes, and a view every 10th table.
 */
const STRESS_5000: DumpStats = {
  tables: 5000,
  indexes: 10_000,
  indexBackedConstraints: 10_000,
  sequences: 5000,
  views: 500,
  materializedViews: 0,
};

describe('estimateRelations', () => {
  it('counts nothing for an empty dump', () => {
    expect(estimateRelations(NOTHING)).toBe(0);
  });

  it.each([
    { kind: 'tables', weight: 3 },
    { kind: 'materializedViews', weight: 3 },
    { kind: 'indexes', weight: 1 },
    { kind: 'indexBackedConstraints', weight: 1 },
    { kind: 'sequences', weight: 1 },
    { kind: 'views', weight: 1 },
  ])('counts each of the $kind as $weight relation(s)', ({ kind, weight }) => {
    expect(estimateRelations({ ...NOTHING, [kind]: 1 })).toBe(weight);
    expect(estimateRelations({ ...NOTHING, [kind]: 7 })).toBe(7 * weight);
  });

  it('adds everything up', () => {
    expect(
      estimateRelations({
        tables: 2,
        indexes: 3,
        indexBackedConstraints: 5,
        sequences: 7,
        views: 11,
        materializedViews: 13,
      })
    ).toBe(3 * 2 + 3 + 5 + 7 + 11 + 3 * 13);
  });

  it('estimates 40,500 relations for the 5,000-table stress schema', () => {
    expect(estimateRelations(STRESS_5000)).toBe(40_500);
  });
});

describe('requiredMaxLocksPerTransaction', () => {
  it.each([
    { relations: 0, expected: 64 },
    { relations: 1, expected: 64 },
    { relations: 5120, expected: 64 },
    { relations: 5121, expected: 128 },
    { relations: 10_240, expected: 128 },
    { relations: 10_241, expected: 192 },
    { relations: 15_360, expected: 192 },
    { relations: 15_361, expected: 256 },
    { relations: 40_500, expected: 512 },
    { relations: 1_000_000, expected: 12_544 },
  ])(
    'needs $expected for $relations relations with the default 100 connections',
    ({ relations, expected }) => {
      expect(requiredMaxLocksPerTransaction(relations)).toBe(expected);
      expect(requiredMaxLocksPerTransaction(relations, 100, 0)).toBe(expected);
    }
  );

  it.each([
    { relations: 5000, maxConnections: 10, maxPrepared: 0, expected: 640 },
    { relations: 5000, maxConnections: 10, maxPrepared: 10, expected: 320 },
    { relations: 512, maxConnections: 1, maxPrepared: 0, expected: 640 },
    { relations: 513, maxConnections: 1, maxPrepared: 0, expected: 704 },
    { relations: 100, maxConnections: 3, maxPrepared: 2, expected: 64 },
    { relations: 40_500, maxConnections: 500, maxPrepared: 0, expected: 128 },
  ])(
    'needs $expected for $relations relations, $maxConnections connections and $maxPrepared prepared transactions',
    ({ relations, maxConnections, maxPrepared, expected }) => {
      expect(
        requiredMaxLocksPerTransaction(relations, maxConnections, maxPrepared)
      ).toBe(expected);
    }
  );

  it('is never below the default and always a multiple of 64', () => {
    const results = Array.from({ length: 2000 }, (_, index) =>
      requiredMaxLocksPerTransaction(index * 37, 100, 0)
    );

    expect(
      results.filter(
        (result) =>
          result < DEFAULT_MAX_LOCKS_PER_TRANSACTION || result % 64 !== 0
      )
    ).toEqual([]);
    expect(requiredMaxLocksPerTransaction(0)).toBe(
      DEFAULT_MAX_LOCKS_PER_TRANSACTION
    );
    expect(DEFAULT_MAX_LOCKS_PER_TRANSACTION).toBe(64);
  });

  it('needs 512 for the 5,000-table stress schema', () => {
    expect(requiredMaxLocksPerTransaction(estimateRelations(STRESS_5000))).toBe(
      512
    );
  });
});
