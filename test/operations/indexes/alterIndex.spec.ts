import { describe, expect, it } from 'vitest';
import { alterIndex } from '../../../src/operations/indexes';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
  describe('indexes', () => {
    describe('alterIndex', () => {
      const alterIndexFn = alterIndex(options1);

      it('should return a function', () => {
        expect(alterIndexFn).toBeTypeOf('function');
      });

      it('should set tablespace for an index by default', () => {
        const statement = alterIndexFn('my_index', 'tablespace_name');
        expect(statement).toBe(
          'ALTER INDEX "my_index" SET TABLESPACE "tablespace_name";'
        );
      });

      it('should set tablespace for an index', () => {
        const statement = alterIndexFn('my_index', 'tablespace_name', {
          clause: 'set-table',
        });
        expect(statement).toBe(
          'ALTER INDEX "my_index" SET TABLESPACE "tablespace_name";'
        );
      });

      it('should set tablespace for an index with `if exists` option', () => {
        const statement = alterIndexFn('my_index', 'tablespace_name', {
          clause: 'set-table',
          ifExists: true,
        });
        expect(statement).toBe(
          'ALTER INDEX IF EXISTS "my_index" SET TABLESPACE "tablespace_name";'
        );
      });

      it('should attach partition to an index', () => {
        const statement = alterIndexFn('my_index', 'partition_name', {
          clause: 'attach-partition',
        });
        expect(statement).toBe(
          'ALTER INDEX "my_index" ATTACH PARTITION "partition_name";'
        );
      });

      it('should set extension dependency for an index', () => {
        const statement = alterIndexFn('my_index', 'extension_name', {
          clause: 'extension',
        });
        expect(statement).toBe(
          'ALTER INDEX "my_index" DEPENDS ON EXTENSION "extension_name";'
        );
      });

      it('should set extension dependency for an index with `no` option', () => {
        const statement = alterIndexFn('my_index', 'extension_name', {
          clause: 'extension',
          no: true,
        });
        expect(statement).toBe(
          'ALTER INDEX "my_index" NO DEPENDS ON EXTENSION "extension_name";'
        );
      });

      it('should alter index statistics', () => {
        const statement = alterIndexFn('my_index', null, {
          clause: 'alter',
          columNumber: 2,
          integer: 10,
        });
        expect(statement).toBe(
          'ALTER INDEX "my_index" ALTER 2 SET STATISTICS 10;'
        );
      });

      it('should alter index statistics with `if exists` option', () => {
        const statement = alterIndexFn('my_index', null, {
          clause: 'alter',
          columNumber: 2,
          integer: 10,
          ifExists: true,
        });
        expect(statement).toBe(
          'ALTER INDEX IF EXISTS "my_index" ALTER 2 SET STATISTICS 10;'
        );
      });

      it('should alter index statistics with `column` option', () => {
        const statement = alterIndexFn('my_index', null, {
          clause: 'alter',
          columNumber: 2,
          integer: 10,
          colum: true,
        });
        expect(statement).toBe(
          'ALTER INDEX "my_index" ALTER COLUMN 2 SET STATISTICS 10;'
        );
      });

      it('should alter all indexes in tablespace', () => {
        const statement = alterIndexFn('index_name', 'new_tablespace', {
          clause: 'all',
        });
        expect(statement).toBe(
          'ALTER INDEX ALL IN TABLESPACE "index_name" SET TABLESPACE "new_tablespace";'
        );
      });

      it('should alter all indexes in tablespace with `owned by` option', () => {
        const statement = alterIndexFn('index_name', 'new_tablespace', {
          clause: 'all',
          ownedBy: ['app_user', 'admin_user'],
        });
        expect(statement).toBe(
          'ALTER INDEX ALL IN TABLESPACE "index_name" OWNED BY app_user, admin_user SET TABLESPACE "new_tablespace";'
        );
      });

      it('should alter all indexes in tablespace with `no wait` option', () => {
        const statement = alterIndexFn('index_name', 'new_tablespace', {
          clause: 'all',
          noWait: true,
        });
        expect(statement).toBe(
          'ALTER INDEX ALL IN TABLESPACE "index_name" SET TABLESPACE "new_tablespace" NOWAIT;'
        );
      });
    });
  });
});
