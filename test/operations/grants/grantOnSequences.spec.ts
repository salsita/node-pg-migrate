import { describe, expect, it } from 'vitest';
import type { GrantOnSequencesOptions, Name } from '../../../src';
import { grantOnSequences } from '../../../src/operations/grants';
import { options1, options2 } from '../../presetMigrationOptions';

describe('grantOnSequences', () => {
  const grant = grantOnSequences(options1);

  it('grants the requested privileges on a named sequence', () => {
    expect(
      grant({
        sequences: 'my_table_id_seq',
        roles: 'myrole',
        privileges: ['SELECT', 'USAGE'],
      })
    ).toBe('GRANT SELECT, USAGE ON SEQUENCE "my_table_id_seq" TO "myrole";');
  });

  it('quotes multiple sequence names, schemas and roles', () => {
    expect(
      grant({
        sequences: [{ schema: 'app"schema', name: 'item"ids' }, 'other_ids'],
        roles: ['app"role', 'PUBLIC'],
        privileges: 'UPDATE',
        withGrantOption: true,
      })
    ).toBe(
      'GRANT UPDATE ON SEQUENCE "app""schema"."item""ids", "other_ids" TO "app""role", PUBLIC WITH GRANT OPTION;'
    );
  });

  it('grants and reverses all privileges on all sequences in a quoted schema', () => {
    const grantOptions: GrantOnSequencesOptions = {
      sequences: 'ALL',
      schema: 'app"schema',
      roles: 'PUBLIC',
      privileges: 'ALL',
    };

    expect(grant(grantOptions)).toBe(
      'GRANT ALL ON ALL SEQUENCES IN SCHEMA "app""schema" TO PUBLIC;'
    );
    expect(grant.reverse(grantOptions)).toBe(
      'REVOKE ALL ON ALL SEQUENCES IN SCHEMA "app""schema" FROM PUBLIC;'
    );
  });

  it.each([{}, { schema: undefined }])(
    'rejects bare ALL without a schema (%j), including reversal',
    (schemaOptions) => {
      const grantOptions: GrantOnSequencesOptions = {
        sequences: 'ALL',
        roles: 'reader',
        privileges: 'USAGE',
        ...schemaOptions,
      };
      const error = new Error(
        'The "schema" option is required when "sequences" is "ALL"'
      );

      expect(() => grant(grantOptions)).toThrow(error);
      expect(() => grant.reverse(grantOptions)).toThrow(error);
    }
  );

  it.each([{}, { schema: 'other_schema' }])(
    'preserves explicit ALL names and literal arrays (%j), including reversal',
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
        const grantOptions: GrantOnSequencesOptions = {
          sequences,
          roles: 'reader',
          privileges: 'USAGE',
          ...schemaOptions,
        };

        expect(grant(grantOptions)).toBe(
          `GRANT USAGE ON SEQUENCE ${sql} TO "reader";`
        );
        expect(grant.reverse(grantOptions)).toBe(
          `REVOKE USAGE ON SEQUENCE ${sql} FROM "reader";`
        );
      }
    }
  );

  it('does not widen a named selection when options contain an extra schema', () => {
    const grantOptions = {
      sequences: 'ids',
      schema: 'app',
      roles: 'reader',
      privileges: 'USAGE' as const,
    };

    expect(grant(grantOptions)).toBe(
      'GRANT USAGE ON SEQUENCE "ids" TO "reader";'
    );
  });

  it('uses the configured identifier rendering', () => {
    expect(
      grantOnSequences(options2)({
        sequences: { schema: 'appSchema', name: 'itemIds' },
        roles: 'appRole',
        privileges: 'USAGE',
      })
    ).toBe('GRANT USAGE ON SEQUENCE "app_schema"."item_ids" TO "app_role";');
  });

  it('reverses named grants with revoke options', () => {
    expect(
      grant.reverse({
        sequences: { schema: 'app', name: 'ids' },
        roles: 'reader',
        privileges: ['SELECT', 'USAGE'],
        withGrantOption: true,
        onlyGrantOption: true,
        cascade: true,
      })
    ).toBe(
      'REVOKE GRANT OPTION FOR SELECT, USAGE ON SEQUENCE "app"."ids" FROM "reader" CASCADE;'
    );
  });

  it('reverses grants on all sequences in a schema', () => {
    expect(
      grant.reverse({
        sequences: 'ALL',
        schema: 'app',
        roles: 'PUBLIC',
        privileges: 'ALL',
      })
    ).toBe('REVOKE ALL ON ALL SEQUENCES IN SCHEMA "app" FROM PUBLIC;');
  });
});
