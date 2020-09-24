import { expect } from 'chai'
import { escapeValue, applyType, createSchemalize, createTransformer, StringIdGenerator } from '../src/utils'
import { ColumnDefinitions } from '../src/operations/tablesTypes'
import PgLiteral from '../src/operations/PgLiteral'
import { PgLiteralValue } from '../src/operations/generalTypes'

describe('lib/utils', () => {
  describe('.escapeValue', () => {
    it("parse null to 'NULL'", () => {
      const value = null

      expect(escapeValue(value)).to.equal('NULL')
    })

    it('parse boolean to string', () => {
      const value = true

      expect(escapeValue(value)).to.equal('true')
    })

    it('escape string', () => {
      const value = '#escape_me'

      expect(escapeValue(value)).to.equal('$pga$#escape_me$pga$')
    })

    it('keep number as is', () => {
      const value = 77.7

      expect(escapeValue(value)).to.equal(77.7)
    })

    it('parse array to ARRAY constructor syntax string', () => {
      const value = [[1], [2]]
      const value2 = [['a'], ['b']]

      expect(escapeValue(value)).to.equal('ARRAY[[1],[2]]')
      expect(escapeValue(value2)).to.equal('ARRAY[[$pga$a$pga$],[$pga$b$pga$]]')
    })

    it('parse PgLiteral to unescaped string', () => {
      const value = PgLiteral.create('@l|<e')

      expect(escapeValue(value)).to.equal('@l|<e')
    })

    it('parse object literal to unescaped string', () => {
      const value: PgLiteralValue = { literal: true, value: '@l|<e' }

      expect(escapeValue(value)).to.equal('@l|<e')
    })

    it('PgLiteral serialize to PgLiteralValue', () => {
      const value = PgLiteral.create('@l|<e')
      const literalValue = JSON.parse(JSON.stringify(value))

      expect(escapeValue(literalValue)).to.equal('@l|<e')
    })

    it('parse unexpected type to empty string', () => {
      const value = undefined

      expect(escapeValue(value)).to.equal('')
    })
  })

  describe('.applyType', () => {
    it('convert string', () => {
      const type = 'type'

      expect(applyType(type)).to.eql({ type })
    })

    it('apply id shorthand', () => {
      expect(applyType('id')).to.eql({ type: 'serial', primaryKey: true })
    })

    it('apply shorthand', () => {
      const shorthandName = 'type'
      const shorthandDefinition = { type: 'integer', defaultValue: 1 }
      expect(applyType(shorthandName, { [shorthandName]: shorthandDefinition })).to.eql(shorthandDefinition)
    })

    it('apply recursive shorthand', () => {
      const shorthands: ColumnDefinitions = {
        ref: { type: `integer`, onDelete: `CASCADE` },
        user: { type: `ref`, references: `users` },
      }
      expect(applyType('user', shorthands)).to.eql({
        type: `integer`,
        onDelete: `CASCADE`,
        references: `users`,
      })
    })

    it('detect cycle in recursive shorthand', () => {
      const shorthands: ColumnDefinitions = {
        ref: { type: `user`, onDelete: `CASCADE` },
        user: { type: `ref`, references: `users` },
      }
      expect(() => applyType('user', shorthands)).to.throw()
    })
  })

  describe('.createTransformer', () => {
    it('handle string and Name', () => {
      const t = createTransformer(createSchemalize(true, true))

      expect(
        t('CREATE INDEX {string} ON {name} (id);', {
          string: 'string',
          name: { schema: 'schema', name: 'name' },
        }),
      ).to.equal('CREATE INDEX "string" ON "schema"."name" (id);')
    })

    it('Do not escape PgLiteral', () => {
      const t = createTransformer(createSchemalize(true, true))

      expect(
        t('INSERT INTO s (id) VALUES {values};', {
          values: new PgLiteral(['s1', 's2'].map((e) => `('${e}')`).join(', ')),
        }),
      ).to.equal("INSERT INTO s (id) VALUES ('s1'), ('s2');")
    })

    it('Can use number', () => {
      const t = createTransformer(createSchemalize(true, true))

      expect(
        t('INSERT INTO s (id) VALUES ({values});', {
          values: 1,
        }),
      ).to.equal('INSERT INTO s (id) VALUES (1);')
    })
  })

  describe('.StringIdGenerator', () => {
    it('generates correct sequence', () => {
      const chars = 'abcd'

      const ids = new StringIdGenerator(chars)
      const results = [
        'a',
        'b',
        'c',
        'd',
        'aa',
        'ab',
        'ac',
        'ad',
        'ba',
        'bb',
        'bc',
        'bd',
        'ca',
        'cb',
        'cc',
        'cd',
        'da',
        'db',
        'dc',
        'dd',
        'aaa',
        'aab',
        'aac',
        'aad',
      ]
      results.forEach((res) => {
        expect(ids.next()).to.equal(res)
      })
    })
  })
})
