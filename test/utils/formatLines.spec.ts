import { describe, expect, it } from 'vitest';
import { formatLines } from '../../src/utils';

describe('utils', () => {
  describe('formatLines', () => {
    describe('pretty = false (default)', () => {
      it('should return an empty string for no lines', () => {
        const actual = formatLines([]);

        expect(actual).toBeTypeOf('string');
        expect(actual).toBe('');
      });

      it('should join with comma and a single whitespace on one line', () => {
        const actual = formatLines([
          'CLUSTER ON "a_cluster"',
          'DEPENDS ON EXTENSION "a_extension"',
          'SET (fillfactor = 70, fillfactor2 = 50)',
          'RESET (reset1, reset2)',
        ]);

        expect(actual).toBeTypeOf('string');
        expect(actual).toBe(
          'CLUSTER ON "a_cluster", DEPENDS ON EXTENSION "a_extension", SET (fillfactor = 70, fillfactor2 = 50), RESET (reset1, reset2)'
        );
      });

      it('should keep the semantic keyword of the replacement but drop the indentation', () => {
        const actual = formatLines(
          [
            'CONSTRAINT "zipchk" CHECK (char_length(zipcode) = 5) DEFERRABLE INITIALLY IMMEDIATE',
            'CONSTRAINT "zipchk" CHECK (zipcode <> 0) DEFERRABLE INITIALLY IMMEDIATE',
          ],
          '  ADD '
        );

        expect(actual).toBeTypeOf('string');
        expect(actual).toBe(
          'ADD CONSTRAINT "zipchk" CHECK (char_length(zipcode) = 5) DEFERRABLE INITIALLY IMMEDIATE, ADD CONSTRAINT "zipchk" CHECK (zipcode <> 0) DEFERRABLE INITIALLY IMMEDIATE'
        );
      });

      it('should replace newlines with a whitespace', () => {
        const actual = formatLines(['a\r\nb', 'c\rd', 'e\nf']);

        expect(actual).toBeTypeOf('string');
        expect(actual).toBe('a b, c d, e f');
      });
    });

    describe('pretty = true', () => {
      it('should use a default replace of 2 whitespace', () => {
        const actual = formatLines([], '  ', ',', true);

        expect(actual).toBeTypeOf('string');
        expect(actual).toBe('  ');
      });

      it('should join with comma and a default indent of 2 whitespace', () => {
        const actual = formatLines(
          [
            'CLUSTER ON "a_cluster"',
            'DEPENDS ON EXTENSION "a_extension"',
            'SET (fillfactor = 70, fillfactor2 = 50)',
            'RESET (reset1, reset2)',
          ],
          '  ',
          ',',
          true
        );

        expect(actual).toBeTypeOf('string');
        expect(actual).toBe(`  CLUSTER ON "a_cluster",
  DEPENDS ON EXTENSION "a_extension",
  SET (fillfactor = 70, fillfactor2 = 50),
  RESET (reset1, reset2)`);
      });

      it('should join with comma and a custom replacement', () => {
        const actual = formatLines(
          [
            'CONSTRAINT "zipchk" CHECK (char_length(zipcode) = 5) DEFERRABLE INITIALLY IMMEDIATE',
            'CONSTRAINT "zipchk" CHECK (zipcode <> 0) DEFERRABLE INITIALLY IMMEDIATE',
            'CONSTRAINT "zipchk" EXCLUDE zipcode WITH = DEFERRABLE INITIALLY IMMEDIATE',
          ],
          '  ADD ',
          ',',
          true
        );

        expect(actual).toBeTypeOf('string');
        expect(actual)
          .toBe(`  ADD CONSTRAINT "zipchk" CHECK (char_length(zipcode) = 5) DEFERRABLE INITIALLY IMMEDIATE,
  ADD CONSTRAINT "zipchk" CHECK (zipcode <> 0) DEFERRABLE INITIALLY IMMEDIATE,
  ADD CONSTRAINT "zipchk" EXCLUDE zipcode WITH = DEFERRABLE INITIALLY IMMEDIATE`);
      });

      it('should be immutable', () => {
        const lines: ReadonlyArray<string> = Object.freeze([
          'CONSTRAINT "zipchk" CHECK (char_length(zipcode) = 5) DEFERRABLE INITIALLY IMMEDIATE',
          'CONSTRAINT "zipchk" CHECK (zipcode <> 0) DEFERRABLE INITIALLY IMMEDIATE',
          'CONSTRAINT "zipchk" EXCLUDE zipcode WITH = DEFERRABLE INITIALLY IMMEDIATE',
        ]);
        const actual = formatLines(lines, '  ADD ', ',', true);

        expect(actual).toBeTypeOf('string');
        expect(actual)
          .toBe(`  ADD CONSTRAINT "zipchk" CHECK (char_length(zipcode) = 5) DEFERRABLE INITIALLY IMMEDIATE,
  ADD CONSTRAINT "zipchk" CHECK (zipcode <> 0) DEFERRABLE INITIALLY IMMEDIATE,
  ADD CONSTRAINT "zipchk" EXCLUDE zipcode WITH = DEFERRABLE INITIALLY IMMEDIATE`);
      });

      it('should replace newlines with a whitespace', () => {
        const actual = formatLines(['a\r\nb', 'c\rd', 'e\nf'], '  ', ',', true);

        expect(actual).toBeTypeOf('string');
        expect(actual).toBe(`  a b,
  c d,
  e f`);
      });
    });
  });
});
