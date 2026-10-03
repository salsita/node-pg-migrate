import { describe, expect, it } from 'vitest';
import { rowsToModel } from '../../src/introspect/core/model';
import type { IdentitySequenceRow } from '../../src/introspect/types';
import { columnRow, emptyRows, FACTS, tableRow } from './rows';

// The comment on the sequence of an identity column, which is not an object
// of the model: it is part of its column.

const SEQUENCE: IdentitySequenceRow = {
  schema: 'kitchen',
  name: 'tickets_id_seq',
  type: 'integer',
  start: '1',
  increment: '1',
  minValue: '1',
  maxValue: '2147483647',
  cache: '1',
  cycle: false,
};

describe('rowsToModel', () => {
  it.each([
    { comment: 'Ticket numbers', expected: 'Ticket numbers' },
    { comment: null, expected: undefined },
    { comment: undefined, expected: undefined },
  ])(
    'keeps the comment $comment on an identity sequence',
    ({ comment, expected }) => {
      const model = rowsToModel(
        emptyRows({
          tables: [tableRow(21_001, 'kitchen', 'tickets')],
          columns: [
            columnRow(21_001, 1, 'id', 'integer', {
              attnotnull: true,
              attidentity: 'd',
              identitySequence:
                comment === undefined ? SEQUENCE : { ...SEQUENCE, comment },
            }),
          ],
        }),
        FACTS
      );

      expect(model.tables[0].columns[0].identity).toStrictEqual({
        generation: 'BY DEFAULT',
        sequence: { schema: 'kitchen', name: 'tickets_id_seq' },
        options: {
          type: 'integer',
          start: '1',
          increment: '1',
          minValue: '1',
          maxValue: '2147483647',
          cache: '1',
          cycle: false,
        },
        ...(expected === undefined ? {} : { comment: expected }),
      });
    }
  );
});
