import assert from 'node:assert/strict'
import { test } from 'node:test'
import { caseById, caseByKey, cases, deckById } from '../data/index.ts'
import { arrows } from './geometry.ts'
import { NotationError, examine, layerAfter, parse, setup, solves, turnU } from './engine.ts'

test('every ZBLL and PLL case is here once', () => {
  const [zbll, pll] = [deckById.get('ZBLL')!, deckById.get('PLL')!]
  assert.equal(zbll.cases.length, 472)
  assert.deepEqual(zbll.sets.map((s) => s.cases.length), [72, 72, 72, 40, 72, 72, 72])
  assert.equal(pll.cases.length, 21)
  assert.deepEqual(pll.sets.map((s) => s.cases.length), [4, 12, 5])
  assert.equal(caseByKey.size, 493)
  assert.equal(caseById.size, 493)
})

test('Yiheng Wang’s algorithms come first, and need no AUF from the picture', () => {
  for (const c of deckById.get('PLL')!.cases) {
    const [first] = c.algs.two.main
    assert.equal(first.by, 'Yiheng', c.id)
    assert.equal(first.auf, 0, c.id)
    assert.ok(c.algs.oh.main.length, c.id)
  }
  // by 2025 he had moved to the RUD Gb
  assert.equal(caseById.get('PLL-Gb')!.algs.two.main[0].text, "R' U' R U D' R2 U R' U R U' R U' R2' D")
})

test('a PLL picture has an arrow for each swap and each step of a cycle', () => {
  const count = (id: string) => arrows(caseById.get(id)!.ll).length
  assert.deepEqual(['PLL-T', 'PLL-Ua', 'PLL-H', 'PLL-Aa', 'PLL-E', 'PLL-Ga', 'PLL-Na'].map(count), [2, 3, 2, 3, 2, 6, 2])
  assert.equal(arrows(caseById.get('T1-1')!.ll).length, 0)
})

test('every algorithm solves its own case with the AUF it is listed with', () => {
  let n = 0
  for (const c of cases)
    for (const hand of ['two', 'oh'] as const)
      for (const a of [...c.algs[hand].main, ...c.algs[hand].more]) {
        assert.ok(solves(a.text, c.ll).includes(a.auf), `${c.id} ${a.text}`)
        n++
      }
  assert.ok(n > 3990, String(n))
})

test('any algorithm can be traced back to its case', () => {
  for (const c of cases) {
    const v = examine(c.algs.two.main[0].text)
    assert.ok(v.kind === 'layer' && caseByKey.get(v.key) === c, c.id)
  }
  assert.equal(examine("R U R' U'").kind, 'breaks-f2l')
  assert.equal(examine("R R'").kind, 'does-nothing')
  assert.equal(examine('U').kind, 'does-nothing')
})

test('setup moves put the case on a solved cube, from any angle', () => {
  for (const c of cases)
    for (const hand of ['two', 'oh'] as const)
      for (const a of c.algs[hand].main)
        for (const rot of [0, 1, 2, 3] as const) {
          const moves = setup(a.text, rot - a.auf)
          const layer = layerAfter(moves)
          assert.ok(layer, `${c.id} ${a.text} / ${moves}`)
          assert.ok(solves(a.text, layer).includes(((a.auf - rot + 4) % 4) as 0), `${c.id} ${a.text} / ${moves}`)
        }
})

test('rotating the picture shifts the AUF by the same amount', () => {
  for (const c of cases.slice(0, 120)) {
    const a = c.algs.two.main[0]
    for (const k of [1, 2, 3] as const) assert.ok(solves(a.text, turnU(c.ll, k)).includes(((a.auf - k + 4) % 4) as 0), c.id)
  }
})

test('notation', () => {
  assert.deepEqual(parse("R U2' R3 (U D') r’ L / r"), ['R', 'U2', "R'", 'U', "D'", "r'", 'L'])
  assert.deepEqual(parse("RUR'U'"), ['R', 'U', "R'", "U'"])
  assert.throws(() => parse('R U Q'), NotationError)
  assert.equal(setup("R U R' U2"), "U2 R U' R'")
  assert.equal(setup("z U R' (z')"), "z R U' z'")
})
