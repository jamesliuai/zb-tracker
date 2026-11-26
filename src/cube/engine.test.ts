import assert from 'node:assert/strict'
import { test } from 'node:test'
import { caseById, caseByKey, cases, deckById, decks } from '../data/index.ts'
import { arrows } from './geometry.ts'
import { NotationError, caseKey, examine, isSlot, layerAfter, parse, setup, slotAfter, solves, turnU } from './engine.ts'

const after = (ll: string, moves: string) => (isSlot(ll) ? slotAfter : layerAfter)(moves)

test('every ZBLL, ZBLS and PLL case is here once', () => {
  const [zbll, zbls, pll] = [deckById.get('ZBLL')!, deckById.get('ZBLS')!, deckById.get('PLL')!]
  assert.deepEqual(decks.map((d) => d.id), ['ZBLL', 'ZBLS', 'PLL'])
  assert.equal(zbll.cases.length, 472)
  assert.deepEqual(zbll.sets.map((s) => s.cases.length), [72, 72, 72, 40, 72, 72, 72])
  // F2L cases 1 to 42, each with its edges the eight ways they can be, but fewer once both pieces are in the slot
  assert.equal(zbls.cases.length, 305)
  assert.deepEqual(zbls.sets.map((s) => s.cases.length), [32, 96, 64, 48, 48, 17])
  assert.deepEqual(zbls.subs.map((s) => s.short), Array.from({ length: 42 }, (_, i) => String(i + 1)))
  assert.deepEqual(zbls.subs.slice(36).map((s) => s.cases.length), [3, 2, 4, 4, 2, 2])
  assert.equal(pll.cases.length, 21)
  assert.deepEqual(pll.sets.map((s) => s.cases.length), [4, 12, 5])
  assert.equal(caseByKey.size, 798)
  assert.equal(caseById.size, 798)
})

test('a ZBLS picture keeps the pair and the yellow on the edges, and the slot stays put', () => {
  // the first case as the ZBLS library draws it: the pair on the right, three edges to flip and the fourth in the slot
  const first = caseById.get('ZBLS-1-1')!
  assert.equal(first.name, '1-1')
  assert.equal(first.ll, 'XXXXUFXXFXUXXRRXUDXUXXUXXX')
  const basic = caseById.get('ZBLS-1-8')!
  assert.deepEqual([basic.algs.two.main[0].auf, basic.algs.two.main[0].text], [1, "R U' R'"])
  // taking the pair out sets up the case that puts it back
  assert.equal(caseByKey.get(caseKey(slotAfter("R U R'")!)), basic)
  assert.equal(slotAfter(''), 'XUXUUUXUX' + 'X'.repeat(12) + 'FRFRD')
  assert.equal(turnU(first.ll, 1).slice(21), first.ll.slice(21))
  assert.equal(slotAfter("L U L'"), null, 'another slot')
  assert.equal(slotAfter('y'), null, 'held another way')
})

test('Xuanyi Geng’s algorithm comes first wherever he has one', () => {
  for (const c of deckById.get('ZBLS')!.cases) {
    const all = [...c.algs.two.main, ...c.algs.two.more]
    const [first] = c.algs.two.main
    if (all.some((a) => a.by?.includes('Xuanyi'))) assert.match(first.by!, /^Xuanyi/, c.id)
    else assert.ok(first.by && !first.by.includes('solved.no'), c.id)
    assert.ok(c.algs.two.more.every((a) => / on solved\.no$/.test(a.by!)), c.id)
    assert.equal(c.algs.oh, c.algs.two, c.id)
  }
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
    assert.ok(v.kind === (isSlot(c.ll) ? 'slot' : 'layer') && caseByKey.get(v.key) === c, c.id)
  }
  assert.equal(examine("R U R' U'").kind, 'slot')
  assert.equal(examine("L U L' U'").kind, 'breaks-f2l')
  assert.equal(examine("R R'").kind, 'does-nothing')
  assert.equal(examine('U').kind, 'does-nothing')
  // flipping edges with the pair already in is a ZBLS too
  const v = examine("F R U R' U' F'")
  assert.ok(v.kind === 'slot' && caseByKey.get(v.key)?.sub === 'ZBLS-37')
})

test('setup moves put the case on a solved cube, from any angle', () => {
  for (const c of cases)
    for (const hand of ['two', 'oh'] as const)
      for (const a of c.algs[hand].main)
        for (const rot of [0, 1, 2, 3] as const) {
          const moves = setup(a.text, rot - a.auf)
          const seen = after(c.ll, moves)
          assert.ok(seen, `${c.id} ${a.text} / ${moves}`)
          assert.ok(solves(a.text, seen).includes(((a.auf - rot + 4) % 4) as 0), `${c.id} ${a.text} / ${moves}`)
        }
})

test('rotating the picture shifts the AUF by the same amount', () => {
  for (const c of [...cases.slice(0, 120), ...deckById.get('ZBLS')!.cases]) {
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
