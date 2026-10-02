import { describe, expect, it } from 'vitest';
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
