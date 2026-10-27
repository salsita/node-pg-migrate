import { describe, expect, it } from 'vitest';
import type { Name } from '../../../src';
import { revokeOnSequences } from '../../../src/operations/grants';
import { options1 } from '../../presetMigrationOptions';

describe('revokeOnSequences', () => {
  const revoke = revokeOnSequences(options1);

  it('revokes a single privilege on a named sequence', () => {
    expect(
      revoke({ sequences: 'ids', roles: 'PUBLIC', privileges: 'USAGE' })
    ).toBe('REVOKE USAGE ON SEQUENCE "ids" FROM PUBLIC;');
  });

  it('quotes multiple sequence names, schemas and roles', () => {
    expect(
      revoke({
        sequences: [{ schema: 'app"schema', name: 'item"ids' }, 'other_ids'],
        roles: ['app"role', 'PUBLIC'],
        privileges: ['SELECT', 'UPDATE'],
        onlyGrantOption: true,
        cascade: true,
      })
    ).toBe(
      'REVOKE GRANT OPTION FOR SELECT, UPDATE ON SEQUENCE "app""schema"."item""ids", "other_ids" FROM "app""role", PUBLIC CASCADE;'
    );
  });

  it('revokes all privileges on all sequences in a quoted schema', () => {
    expect(
      revoke({
        sequences: 'ALL',
        schema: 'app"schema',
        roles: 'reader',
        privileges: 'ALL',
        onlyGrantOption: true,
        cascade: true,
      })
    ).toBe(
      'REVOKE GRANT OPTION FOR ALL ON ALL SEQUENCES IN SCHEMA "app""schema" FROM "reader" CASCADE;'
    );
  });

  it.each([{}, { schema: undefined }])(
    'rejects bare ALL without a schema (%j)',
    (schemaOptions) => {
      expect(() =>
        revoke({
          sequences: 'ALL',
          roles: 'reader',
          privileges: 'USAGE',
          ...schemaOptions,
        })
      ).toThrow(
        new Error('The "schema" option is required when "sequences" is "ALL"')
      );
    }
  );

  it.each([{}, { schema: 'other_schema' }])(
    'preserves explicit ALL names and literal arrays (%j)',
    (schemaOptions) => {
      const selections: Array<{ sequences: Name | Name[]; sql: string }> = [
        { sequences: { name: 'ALL' }, sql: '"ALL"' },
        {
          sequences: { schema: 'app"schema', name: 'ALL' },
          sql: '"app""schema"."ALL"',
        },
        // Arrays are named selections, even with one element named ALL.
        { sequences: ['ALL'], sql: '"ALL"' },
        { sequences: ['ALL', 'foo'], sql: '"ALL", "foo"' },
      ];

      for (const { sequences, sql } of selections) {
        expect(
          revoke({
            sequences,
            roles: 'reader',
            privileges: 'USAGE',
            ...schemaOptions,
          })
        ).toBe(`REVOKE USAGE ON SEQUENCE ${sql} FROM "reader";`);
      }
    }
  );

  it('does not widen named selections when options contain an extra schema', () => {
    const revokeOptions = {
      sequences: [{ schema: 'app', name: 'ids' }, 'other_ids'],
      schema: 'app',
      roles: 'reader',
      privileges: 'USAGE' as const,
    };

    expect(revoke(revokeOptions)).toBe(
      'REVOKE USAGE ON SEQUENCE "app"."ids", "other_ids" FROM "reader";'
    );
  });
});
