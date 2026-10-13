import { describe, expect, it, vi } from 'vitest';
import type { ColumnDefinitions } from '../../../src';
import { addColumns, createTable } from '../../../src/operations/tables';
import { options1, options2 } from '../../presetMigrationOptions';

describe('column check callbacks', () => {
  it.each([
    [options1, 'retailPrice', '"retailPrice"'],
    [options2, 'retailPrice', '"retail_price"'],
    [options1, 'price"表.$', '"price""表.$"'],
    [options1, 'select', '"select"'],
  ])(
    'passes the rendered identifier for %s / %s',
    (options, name, identifier) => {
      const check = vi.fn((column: string) => `${column} > 0`);
      const sql = createTable(options)(
        { schema: 'shop', name: 'products' },
        { [name]: { type: 'numeric', check } }
      );

      expect(sql).toBe(
        `CREATE TABLE "shop"."products" (${identifier} numeric CHECK (${identifier} > 0));`
      );
      expect(check).toHaveBeenCalledExactlyOnceWith(identifier);
    }
  );

  it('resolves chained shorthands independently for each column without mutating them', () => {
    const check = vi.fn((column: string) => `${column} > 0`);
    const price = Object.freeze({ type: 'numeric', check });
    const typeShorthands: ColumnDefinitions = Object.freeze({
      price,
      requiredPrice: { type: 'price', notNull: true },
    });
    const options = { ...options1, typeShorthands };

    expect(
      createTable(options)('products', {
        retail_price: 'price',
        wholesale_price: 'requiredPrice',
      })
    ).toBe(
      'CREATE TABLE "products" ("retail_price" numeric CHECK ("retail_price" > 0), "wholesale_price" numeric NOT NULL CHECK ("wholesale_price" > 0));'
    );
    expect(addColumns(options)('offers', { sale_price: 'price' })).toBe(
      'ALTER TABLE "offers" ADD "sale_price" numeric CHECK ("sale_price" > 0);'
    );
    expect(check.mock.calls).toEqual([
      ['"retail_price"'],
      ['"wholesale_price"'],
      ['"sale_price"'],
    ]);
    expect(typeShorthands.price).toBe(price);
    expect(price.check).toBe(check);
  });

  it('preserves column overrides and literal SQL strings', () => {
    const inheritedCheck = vi.fn((column: string) => `${column} > 0`);
    const sql = createTable({
      ...options1,
      typeShorthands: { price: { type: 'numeric', check: inheritedCheck } },
    })('products', {
      discounted: { type: 'price', check: 'discounted >= 0' },
      bounded: {
        type: 'price',
        check: (column) => `${column} BETWEEN 1 AND 10`,
      },
      unchecked: { type: 'price', check: undefined },
      label: { type: 'text', check: "label <> '${column}'" },
    });

    expect(sql).toBe(
      'CREATE TABLE "products" ("discounted" numeric CHECK (discounted >= 0), "bounded" numeric CHECK ("bounded" BETWEEN 1 AND 10), "unchecked" numeric, "label" text CHECK (label <> \'${column}\'));'
    );
    expect(inheritedCheck).not.toHaveBeenCalled();
  });
});
