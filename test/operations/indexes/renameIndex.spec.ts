import { describe, expect, it } from 'vitest';
import { renameIndex } from '../../../src/operations/indexes';
import { options1 } from '../../presetMigrationOptions';

describe('operations', () => {
    describe('indexes', () => {
        describe('renameIndex', () => {
            const renameIndexFn = renameIndex(options1);

            it('should return a function', () => {
                expect(renameIndexFn).toBeTypeOf('function');
            });

            it('should generate correct SQL for renaming an index', () => {
                const statement = renameIndexFn('my_index', 'new_index');
                expect(statement).toBe('ALTER INDEX my_index RENAME TO new_index;');
            });

            it('should generate correct SQL for renaming an index with `if exists` option', () => {
                const statement = renameIndexFn('my_index', 'new_index', {
                    ifExists: true,
                });
                expect(statement).toBe('ALTER INDEX IF EXISTS my_index RENAME TO new_index;');
            });

            it('should set tablespace for an index', () => {
                const statement = renameIndexFn('my_index', 'tablespace_name', {
                    clause: 'set-table',
                });
                expect(statement).toBe('ALTER INDEX my_index SET TABLESPACE tablespace_name;');
            });

            it('should set tablespace for an index with `if exists` option', () => {
                const statement = renameIndexFn('my_index', 'tablespace_name', {
                    clause: 'set-table',
                    ifExists: true,
                });
                expect(statement).toBe('ALTER INDEX IF EXISTS my_index SET TABLESPACE tablespace_name;');
            });

            it('should attach partition to an index', () => {
                const statement = renameIndexFn('my_index', 'partition_name', {
                    clause: 'attach-partition',
                });
                expect(statement).toBe('ALTER INDEX my_index ATTACH PARTITION partition_name;');
            });

            it('should set extension dependency for an index', () => {
                const statement = renameIndexFn('my_index', 'extension_name', {
                    clause: 'extension',
                });
                expect(statement).toBe('ALTER INDEX my_index DEPENDS ON EXTENSION extension_name;');
            });

            it('should set extension dependency for an index with `no` option', () => {
                const statement = renameIndexFn('my_index', 'extension_name', {
                    clause: 'extension',
                    no: true,
                });
                expect(statement).toBe('ALTER INDEX my_index NO DEPENDS ON EXTENSION extension_name;');
            });

            it('should alter index statistics', () => {
                const statement = renameIndexFn('my_index', null, {
                    clause: 'alter',
                    columNumber: 2,
                    integer: 10,
                });
                expect(statement).toBe('ALTER INDEX my_index ALTER 2 SET STATISTICS 10;');
            });

            it('should alter index statistics with `if exists` option', () => {
                const statement = renameIndexFn('my_index', null, {
                    clause: 'alter',
                    columNumber: 2,
                    integer: 10,
                    ifExists: true,
                });
                expect(statement).toBe('ALTER INDEX IF EXISTS my_index ALTER 2 SET STATISTICS 10;');
            });

            it('should alter index statistics with `column` option', () => {
                const statement = renameIndexFn('my_index', null, {
                    clause: 'alter',
                    columNumber: 2,
                    integer: 10,
                    colum: true,
                });
                expect(statement).toBe('ALTER INDEX my_index ALTER COLUMN 2 SET STATISTICS 10;');
            });

            it('should alter all indexes in tablespace', () => {
                const statement = renameIndexFn('my_tablespace', 'new_tablespace', {
                    clause: 'all',
                });
                expect(statement).toBe('ALTER INDEX ALL IN TABLESPACE my_tablespace SET TABLESPACE new_tablespace;');
            });

            it('should alter all indexes in tablespace with `owned by` option', () => {
                const statement = renameIndexFn('my_tablespace', 'new_tablespace', {
                    clause: 'all',
                    ownedBy: ['app_user', 'admin_user'],
                });
                expect(statement).toBe('ALTER INDEX ALL IN TABLESPACE my_tablespace OWNED BY app_user, admin_user SET TABLESPACE new_tablespace;');
            });

            it('should alter all indexes in tablespace with `no wait` option', () => {
                const statement = renameIndexFn('my_tablespace', 'new_tablespace', {
                    clause: 'all',
                    noWait: true,
                });
                expect(statement).toBe('ALTER INDEX ALL IN TABLESPACE my_tablespace SET TABLESPACE new_tablespace NOWAIT;');
            });
        });
    });
});
