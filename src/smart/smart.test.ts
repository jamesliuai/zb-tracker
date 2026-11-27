import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cubeAfter, fromFacelets, isSolved, plain, sameCube, solvedCube, turned, undo, yellowUp, type Cube } from '../cube/engine.ts'
import { caseById, deckById } from '../data/index.ts'
import { readData, solvesOf, timedBySmartCube } from '../state/store.ts'
import { practised } from '../train/schedule.ts'
import { arrived, asReported, guide, step, tokens, type Front, type Guide } from './guide.ts'
import { elapsed, finished, read, which, type Turn } from './solve.ts'

/** The guide after these turns of a cube held this way, and the cube. */
function turn(g: Guide, cube: Cube, text: string, k: Front = 0): [Guide, Cube] {
  for (const m of asReported(k, text)) {
    g = step(g, m)
    cube = turned(cube, m)
  }
  return [g, cube]
}
const shown = (g: Guide) => tokens(g).map((t) => (t.is === 'done' ? `(${t.move})` : t.is === 'todo' ? t.move : `${t.is}:${t.move}`)).join(' ')

test('a smart cube’s stickers come in white on top, and turn over to yellow on top', () => {
  assert.ok(isSolved(fromFacelets('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB')!))
  // F R done on a cube held white on top, green in front, from the library's own notes
  const fr = fromFacelets('UUFUUFLLFUUURRRRRRFFRFFDFFDRRBDDBDDBLLDLLDLLDLBBUBBUBB')!
  assert.ok(sameCube(fr, cubeAfter(['F', 'R'].map(yellowUp).join(' '))))
  assert.equal(yellowUp("U'"), "D'")
  assert.equal(fromFacelets('UUUU'), null, 'a 2x2')
})

test('the guide follows a scramble, slips and all', () => {
  const text = "R U2 F' D U' L"
  let g = guide(text)
  let cube = solvedCube
  assert.equal(shown(g), "next:R U2 F' D U' L")
  ;[g, cube] = turn(g, cube, 'R U')
  assert.equal(shown(g), "(R) half:U2 F' D U' L", 'half of a half turn')
  ;[g, cube] = turn(g, cube, "U F")
  assert.equal(shown(g), "(R) (U2) fix:F2 D U' L", 'the wrong way round')
  ;[g, cube] = turn(g, cube, "F'")
  assert.equal(shown(g), "(R) (U2) next:F' D U' L", 'put right')
  ;[g, cube] = turn(g, cube, "F'")
  assert.equal(shown(g), "(R) (U2) (F') next:D U' L")
  ;[g, cube] = turn(g, cube, "U'")
  assert.equal(shown(g), "(R) (U2) (F') next:D (U') L", 'U and D the other way round')
  ;[g, cube] = turn(g, cube, 'B')
  assert.equal(shown(g), "(R) (U2) (F') fix:B' D (U') L", 'the wrong face')
  ;[g, cube] = turn(g, cube, "B' D")
  assert.equal(arrived(g, cube), null)
  ;[g, cube] = turn(g, cube, 'L')
  assert.equal(shown(g), "(R) (U2) (F') (D) (U') (L)")
  assert.equal(arrived(g, cube), 0)
  assert.ok(sameCube(cube, cubeAfter(text)))
})

test('the guide works out which side faces you, without a slip changing its mind', () => {
  const text = "R U F' R2 D' B L"
  // held another way all along: it takes over once it's clearly the one
  let [g, cube] = turn(guide(text), solvedCube, text, 2)
  assert.equal(g.front, 2)
  assert.equal(arrived(g, cube), 2)
  // one slip on the first turn, the right face held the usual way
  ;[g, cube] = turn(guide(text), solvedCube, 'F')
  assert.equal(g.front, 0)
  assert.equal(shown(g), "fix:F' R U F' R2 D' B L")
  ;[g, cube] = turn(g, cube, "F' " + text)
  assert.equal(arrived(g, cube), 0)
})

test('a solve is over once it’s solved, or for a ZBLS once the pair is in and the edges are oriented', () => {
  const zbll = caseById.get(deckById.get('ZBLL')!.cases[0].id)!
  const zbls = deckById.get('ZBLS')!.cases[0]
  assert.ok(finished(zbll, solvedCube))
  assert.ok(!finished(zbll, cubeAfter("R U R' U R U2 R'")))
  assert.ok(finished(zbls, cubeAfter("R U R' U R U2 R'")), 'a Sune leaves the edges oriented')
  assert.ok(!finished(zbls, cubeAfter("F R U R' U' F'")))
})

/** Turns a tenth of a second apart, as the cube would send them, with a cube clock that runs 1% fast. */
function sent(moves: string[], from = 1000, gap = 100, clock = true): Turn[] {
  return moves.map((move, i) => ({ move, at: from + i * gap + 7, host: from + i * gap, cube: clock ? Math.round(i * gap * 1.01) : null }))
}

/** Half turns as two quarter turns, the way most cubes send them, one way round or the other. */
const quarters = (moves: string[], flip = false) => moves.flatMap((m) => (m.endsWith('2') ? (flip ? [m[0] + "'", m[0] + "'"] : [m[0], m[0]]) : [m]))

test('every algorithm, done as written from any side, is itself and no slip', () => {
  for (const deck of ['ZBLL', 'ZBLS', 'PLL'] as const)
    for (const c of deckById.get(deck)!.cases) {
      const texts = [...c.algs.two.main, ...c.algs.two.more, ...c.algs.oh.main, ...c.algs.oh.more].map((a) => a.text)
      texts.forEach((text, i) => {
        const k = (i % 4) as Front
        const moves = asReported(k, text)
        const from = cubeAfter(undo(moves).join(' '))
        // the turn before is the one that finished the scramble
        const [start, ...turns] = sent(['U', ...quarters(moves, i % 2 === 1)])
        const s = read(c, start, turns, from, texts)
        assert.equal(s.astray, false, `${c.id} ${text}`)
        assert.ok(s.alg !== null, `${c.id} ${text}`)
        assert.ok(finished(c, turns.reduce((x, t) => turned(x, t.move), from)), `${c.id} ${text}`)
      })
    }
})

test('a wrong algorithm first is a slip, and the time splits into recognizing and solving', () => {
  const c = caseById.get('U1-1')!
  const right = plain(c.algs.two.main[0].text)
  const from = cubeAfter(undo(right).join(' '))
  // a Sune first, then back out of it, then the right one
  const wrong = plain("R U R' U R U2 R'")
  const moves = [...wrong, ...undo(wrong), ...right]
  const start: Turn = { move: 'U', at: 500, host: 500, cube: -808 }
  const turns = sent(moves, 1300)
  const s = read(c, start, turns, from, [c.algs.two.main[0].text])
  assert.equal(s.astray, true)
  // taken back turn for turn, the Sune cancels out, and what's left is the right one
  assert.equal(s.alg, c.algs.two.main[0].text)
  assert.equal(s.look, 80, 'eight tenths before the first turn')
  assert.ok(Math.abs(s.cs - (80 + (moves.length - 1) * 10)) <= 1, `${s.cs}`)
})

test('times come from the cube’s clock, unless it has none or it’s way off', () => {
  // the cube clock is steady while Bluetooth wobbles
  const wobbly: Turn[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => ({ move: 'R', at: 0, host: i * 100 + (i % 2 ? 40 : -40), cube: i * 100 }))
  assert.ok(Math.abs(elapsed(wobbly).at(-1)! - 1200) < 5, `${elapsed(wobbly).at(-1)}`)
  // a lost turn the cube sent later has no time of its own
  const lost = sent(['R', 'U', "R'", "U'"])
  lost[2] = { ...lost[2], host: null, cube: null, at: 5000 }
  assert.deepEqual(elapsed(lost).map(Math.round), [0, 101, 202, 303])
  // no cube clock
  assert.deepEqual(elapsed(sent(['R', 'U'], 0, 250, false)), [0, 250])
  // a cube clock that jumps back is wrong, not this computer
  const jump = sent(['R', 'U', 'F'])
  jump[2] = { ...jump[2], cube: 3 }
  assert.deepEqual(elapsed(jump), [0, 100, 200])
})

test('an algorithm is known by its turns, whatever order a slice’s two faces come in', () => {
  // M′ comes from the cube as a turn of R and of L, either way round
  assert.equal(which(["R'", 'L', 'F'], ["M' U"]), "M' U")
  assert.equal(which(['L', "R'", 'F'], ["M' U"]), "M' U")
  assert.equal(which(['R', "L'", 'B'], ["M' U"]), "M' U", 'done from the back')
  assert.equal(which(["R'", 'L', 'B'], ["M' U"]), null)
  assert.equal(which(['U', 'R', 'U', "R'", "U'"], ["R U R'"]), "R U R'", 'turns of the top at either end')
  assert.equal(which(plain("y R U R'"), ["R U R'"]), "R U R'", 'held another way')
})

test('smart cube times are kept apart from the space bar’s, survive an export, and nothing odd gets in', () => {
  const smart = practised(undefined, true, 250, 1000, 60)
  assert.deepEqual(smart.smart, { times: [250], look: [60], best: 250 })
  assert.equal(smart.times, undefined)
  const both = practised(smart, true, 300, 2000)
  assert.deepEqual([both.times, both.best, both.smart], [[300], 300, smart.smart])
  assert.deepEqual(solvesOf(both, true), { times: [250], best: 250, look: [60] })
  assert.deepEqual(solvesOf(both, false), { times: [300], best: 300 })

  const data = readData({
    cases: {},
    prefs: { way: 'smart', front: 2 },
    practice: { 'T1-1': { n: 3, at: 1, due: 2, days: 1, smart: { times: [200, 'x', 150, 900], look: [50, 10, -1, 1000], best: 120 } } },
    cubeDrills: { 'T1-1': { "R U R'": { n: 2, times: [90, 80], best: 70, at: 1 } }, nope: { "R U R'": { n: 1, times: [50], best: 50, at: 1 } } },
  })!
  assert.equal(data.prefs.way, 'smart')
  assert.equal(data.prefs.front, 2)
  // a time with no sensible part before the first turn goes, and so does the one that isn't a time
  assert.deepEqual(data.practice['T1-1'].smart, { times: [200], look: [50], best: 120 })
  assert.deepEqual(data.cubeDrills, { 'T1-1': { "R U R'": { n: 2, times: [90, 80], best: 70, at: 1 } } })
  assert.deepEqual(data.drills, {})
  assert.equal(readData({ cases: {}, prefs: { way: 'bluetooth', front: 7 } })!.prefs.way, 'cube')
  // picking a smart cube to see what it is doesn't hide the space bar's times, until one has timed something
  assert.equal(timedBySmartCube(data), true)
  assert.equal(timedBySmartCube(readData({ cases: {}, prefs: { way: 'smart' }, practice: { 'T1-1': { n: 1, at: 1, due: 2, days: 1, times: [300], best: 300 } } })!), false)
})
