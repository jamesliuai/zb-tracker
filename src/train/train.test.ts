import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AUF, caseKey, layerAfter, plain, solves, tidy, turnU, undo } from '../cube/engine.ts'
import { SOLVED_LL } from '../cube/geometry.ts'
import { cases, deckById } from '../data/index.ts'
import { chosen, need } from '../state/choose.ts'
import { readData, type Data } from '../state/store.ts'
import { DAY, plan, practised, ROUND } from './schedule.ts'
import { scramble } from './scramble.ts'

/** The same numbers every run. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const solvedUpToU = new Set([0, 1, 2, 3].map((k) => turnU(SOLVED_LL, k)))
const dropLastU = (moves: string[]) => (moves.at(-1)?.[0] === 'U' ? moves.slice(0, -1) : moves)

test('turns of the six faces alone do what every algorithm does', () => {
  for (const c of cases)
    for (const hand of ['two', 'oh'] as const)
      for (const a of [...c.algs[hand].main, ...c.algs[hand].more]) {
        const p = plain(a.text).join(' ')
        assert.match(p, /^([UDRLFB]['2]?)( [UDRLFB]['2]?)*$/, `${c.id} ${a.text}`)
        assert.deepEqual(solves(p, c.ll), solves(a.text, c.ll), `${c.id} ${a.text} / ${p}`)
      }
  assert.deepEqual(plain("r U R' U' r' F R F'"), ['L', 'F', "R'", "F'", "L'", 'F', 'R', "F'"])
  assert.deepEqual(plain('M2 U M2 U2 M2 U M2').join(' '), 'R2 L2 D R2 L2 U2 R2 L2 D R2 L2')
  assert.deepEqual(tidy(['U', 'D', "U'", 'R', "R'"]), ['D'])
})

test('every case gets a scramble that sets it up, seen from the side the trainer says', () => {
  const random = seeded(7)
  for (const c of cases) {
    const s = scramble(c, random)
    const moves = s.moves.split(' ')
    assert.match(s.moves, /^([UDRLFB]['2]?)( [UDRLFB]['2]?)*$/, c.id)
    assert.ok(moves.length <= 28, `${c.id} ${s.moves}`)
    const layer = layerAfter(s.moves)
    assert.ok(layer && caseKey(layer) === caseKey(c.ll), `${c.id} ${s.moves}`)
    // what the reveal says to do from there, done on the scrambled cube, solves it
    const pick = chosen(c, { rot: 0, alg: null, rec: '', auf: '' }, 'two')
    const turn = need(c, pick.text, s.view)!
    const after = layerAfter([...moves, ...(AUF[turn] ? [AUF[turn]] : []), ...plain(pick.text)].join(' '))
    assert.ok(after && solvedUpToU.has(after), `${c.id} ${s.moves} then ${AUF[turn]} ${pick.text}`)
  }
})

test('a scramble never undoes one of the case’s own algorithms', () => {
  const random = seeded(11)
  for (const c of cases) {
    const own = new Set(
      (['two', 'oh'] as const).flatMap((h) => [...c.algs[h].main, ...c.algs[h].more]).map((a) => dropLastU(tidy([...undo(plain(a.text))])).join(' ')),
    )
    for (let i = 0; i < 3; i++) assert.ok(!own.has(dropLastU(scramble(c, random).moves.split(' ')).join(' ')), c.id)
  }
})

test('a case doesn’t come from any of its last six scrambles', () => {
  const random = seeded(3)
  for (const id of ['T1-1', 'S1-3', 'H3-2', 'PLL-T', 'PLL-H', 'PLL-Ra']) {
    const c = cases.find((x) => x.id === id)!
    const list = Array.from({ length: 21 }, () => dropLastU(scramble(c, random).moves.split(' ')).join(' '))
    list.forEach((s, i) => assert.ok(!list.slice(Math.max(0, i - 6), i).includes(s), `${id} repeats ${s}`))
    assert.ok(new Set(list).size >= 12, `${id}: only ${new Set(list).size} different`)
  }
})

test('getting a case spaces it out, slow less so, and missing it brings it back', () => {
  const t = Date.UTC(2026, 0, 1)
  let p = practised(undefined, true, 300, t)
  assert.deepEqual([p.n, p.days, p.due, p.best, p.times], [1, 1, t + DAY, 300, [300]])
  // again the same evening counts for nothing more
  p = practised(p, true, 280, t + 3600_000)
  assert.equal(p.days, 1)
  assert.equal(p.best, 280)
  p = practised(p, true, 290, t + 2 * DAY)
  assert.equal(p.days, 2.5)
  p = practised(p, true, 600, t + 5 * DAY)
  assert.equal(p.days, 3.5, 'twice as slow as usual grows the gap less')
  assert.equal(p.run, 4)
  p = practised(p, false, null, t + 9 * DAY)
  assert.deepEqual([p.days, p.due, p.miss, p.run, p.best], [0, t + 9 * DAY, 1, 0, 280])
  // without a cube nothing is timed, but it still counts
  p = practised(p, true, null, t + 10 * DAY)
  assert.deepEqual([p.days, p.times?.length, p.n], [1, 4, 6])
  for (let i = 0; i < 20; i++) p = practised(p, true, 250 + i, t + (20 + i * 400) * DAY)
  assert.equal(p.times!.length, 12)
  assert.equal(p.days, 180)
})

test('a round of what’s due: what you’re learning, then learned cases by how overdue they are', () => {
  const zbll = deckById.get('ZBLL')!
  const now = Date.UTC(2026, 5, 1)
  const data: Pick<Data, 'cases' | 'practice'> = { cases: {}, practice: {} }
  for (const c of zbll.sets[0].cases) data.cases[c.id] = { s: 2, at: 1 }
  for (const c of zbll.sets[1].subs[0].cases) data.cases[c.id] = { s: 1 }
  // one learned case well overdue, one a little, one not due yet
  data.practice['T2-3'] = { n: 3, at: now - 30 * DAY, due: now - 20 * DAY, days: 10 }
  data.practice['T2-4'] = { n: 3, at: now - 3 * DAY, due: now - DAY, days: 2 }
  data.practice['T2-5'] = { n: 3, at: now, due: now + DAY, days: 1 }
  const p = plan(zbll, 'due', [], data, now)
  assert.equal(p.ids.length, ROUND)
  assert.equal(p.learning, 12)
  assert.equal(p.later, 12 + 71 - ROUND)
  assert.ok(['T2-3', 'T2-4', 'U1-1', 'U1-12'].every((id) => p.ids.includes(id)))
  assert.ok(!p.ids.includes('T2-5'))
  // never practiced comes after overdue, in the order of the deck
  assert.ok(p.ids.includes('T1-1') && !p.ids.includes('T6-12'))

  assert.equal(plan(zbll, 'learning', [], data, now).ids.length, 12)
  assert.equal(plan(zbll, 'learned', [], data, now).ids.length, 72)
  assert.equal(plan(zbll, 'all', [], data, now).ids.length, 472)
  assert.deepEqual(plan(zbll, 'pick', ['PLL-T', 'T1-2', 'T1-1'], data, now).ids, ['T1-1', 'T1-2'])
})

test('saved practice survives an export, and nothing odd gets in', () => {
  const back = readData({
    cases: {},
    prefs: { way: 'screen', pool: { ZBLL: 'pick', PLL: 'nonsense', XYZ: 'all' }, pick: ['T1-1', 'T1-1', 'Q9'] },
    practice: {
      'T1-1': { n: 4, miss: 9, run: 2, times: [310, -4, 'x', 290.4], best: 290, at: 5, due: 6, days: 2.5 },
      'T1-2': { n: 0 },
      nope: { n: 3, at: 1, due: 1, days: 1 },
    },
  })!
  assert.deepEqual(back.practice, { 'T1-1': { n: 4, miss: 4, run: 2, times: [310, 290], best: 290, at: 5, due: 6, days: 2.5 } })
  assert.equal(back.prefs.way, 'screen')
  assert.deepEqual(back.prefs.pool, { ZBLL: 'pick' })
  assert.deepEqual(back.prefs.pick, ['T1-1'])
  // dates no clock could show become ones it can
  const odd = readData({ cases: {}, practice: { 'T1-1': { n: 1, at: 1000, due: 9e15, days: 2 }, 'T1-2': { n: 1, at: 9e15, due: 9e15, days: 2 } } })!.practice
  assert.equal(odd['T1-1'].due, 1000 + 366 * DAY)
  assert.ok(odd['T1-2'].at <= Date.now() + DAY && Number.isFinite(new Date(odd['T1-2'].due).getTime()))
  // an export from before there was a trainer
  const old = readData({ cases: { 'T1-1': { s: 2 } }, prefs: { theme: 'dark' } })!
  assert.deepEqual([old.practice, old.prefs.way, old.prefs.pick], [{}, 'cube', []])
})
