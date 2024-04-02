import { describe, expect, it } from 'vitest';
import { createRole } from '../../../src/operations/roles';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('roles', () => {
    describe('createRole', () => {
      const createRoleFn = createRole(options1);

      it('should return a function', () => {
        expect(createRoleFn).toBeTypeOf('function');
      });

      it('should return sql statement', () => {
        const statement = createRoleFn('jonathan');

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE ROLE "jonathan" WITH NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOLOGIN NOREPLICATION;'
        );
      });

      it('should return sql statement with roleOptions', () => {
        const statement = createRoleFn('miriam', {
          login: true,
          password: 'jw8s0F4',
          valid: '2005-01-01',
          superuser: false,
          createdb: false,
          createrole: false,
          inherit: false,
          replication: false,
          bypassrls: false,
          limit: 10,
          inRole: 'admin',
          role: 'user',
          admin: 'admin',
        });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE ROLE "miriam" WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT LOGIN NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 10 ENCRYPTED PASSWORD $pga$jw8s0F4$pga$ VALID UNTIL $pga$2005-01-01$pga$ IN ROLE admin ROLE user ADMIN admin;'
        );
      });

      it('should return sql statement with schema', () => {
        const statement = createRoleFn({ name: 'miriam', schema: 'myschema' });

        expect(statement).toBeTypeOf('string');
        expect(statement).toBe(
          'CREATE ROLE "myschema"."miriam" WITH NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOLOGIN NOREPLICATION;'
        );
      });

      describe('reverse', () => {
        it('should contain a reverse function', () => {
          expect(createRoleFn.reverse).toBeTypeOf('function');
        });

        it('should return sql statement', () => {
          const statement = createRoleFn.reverse('jonathan');

          expect(statement).toBeTypeOf('string');
          expect(statement).toBe('DROP ROLE "jonathan";');
        });
      });
    });
  });
});
