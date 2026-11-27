import assert from 'node:assert/strict'
import { test } from 'node:test'
import fc from 'fast-check'
import { compare } from './version.ts'

const version = fc
  .tuple(
    fc.nat(99),
    fc.array(fc.constantFrom('0', '1', '9', '10', 'a', 'b', 'rc', '.', '-', ' ', '('), {
      maxLength: 8
    })
  )
  .map(([major, rest]) => `${major}${rest.join('')}`)

test('compare orders versions that start with a number consistently', () => {
  fc.assert(
    fc.property(version, version, version, (a, b, c) => {
      assert.equal(compare(a, b) + compare(b, a), 0)

      if (compare(a, b) <= 0 && compare(b, c) <= 0) assert.ok(compare(a, c) <= 0)
    })
  )
})

test('compare ranks versions as Sparkle does', () => {
  const ascending: [string, string][] = [
    ['1.0', '1.1'],
    ['0.9', '1.0a1'],
    ['1.0a1', '1.0b1'],
    ['1.0b', '1.0b2'],
    ['1.0b9', '1.0b10'],
    ['1.0b1', '1.0'],
    ['1.0rc', '1.0'],
    ['1.0', '1.0.1'],
    ['1.5.5', '1.5.6a1'],
    ['1.1.1b2', '1.1.2a1'],
    ['1.0 (1234)', '1.0 (1235)'],
    ['1.0b1 (1234)', '1.0 (1234)'],
    ['1.0b5 (1234)', '1.0.1b5 (1234)'],
    ['3.3 (5847)', '3.3.1b1 (5902)'],
    ['2.0.0.2429', '2.0.0.2430'],
    ['201210251627', '201211051041']
  ]

  for (const [older, newer] of ascending) {
    assert.equal(compare(older, newer), -1)
    assert.equal(compare(newer, older), 1)
  }

  assert.equal(compare('1.0', '1.0.0'), 0)
  assert.equal(compare('1', '1.0.0'), 0)
})
