/**
 * What a smart cube saw of a solve: how long it took to recognize the case and to do it, by the
 * cube's own clock where it has one, whether it went through another case on the way, which means a
 * wrong algorithm, and which of the case's algorithms it was.
 */
import { caseKey, cubeAfter, edgesOriented, isSlot, isSolved, plain, slotDone, slotOf, tidy, topOf, turned, undo, type Cube } from '../cube/engine.ts'
import { SOLVED_LL } from '../cube/geometry.ts'
import type { Case } from '../data/index.ts'

export interface Turn {
  /** With yellow on top, as the cube reports it. */
  move: string
  /** When it arrived, on this computer's clock (performance.now), in milliseconds. */
  at: number
  /** This computer's time for it, except for a turn the cube only sent later, after a lost message. */
  host: number | null
  /** The cube's own clock, in milliseconds, where it has one. */
  cube: number | null
}

/** Whether a solve is over: for a ZBLS, once the pair is in and the edges on top are oriented; otherwise once it's solved. */
export const finished = (c: Case, cube: Cube) => (isSlot(c.ll) ? slotDone(cube) : isSolved(cube))

/** The cube's times filled in where it gave none, from the ones either side. */
function fill(turns: Turn[]): number[] {
  const clock = turns.map((t) => t.host ?? t.at)
  return turns.map((t, i) => {
    if (t.cube !== null) return t.cube
    let a = i - 1
    while (a >= 0 && turns[a].cube === null) a--
    let b = i + 1
    while (b < turns.length && turns[b].cube === null) b++
    if (a >= 0 && b < turns.length) return turns[a].cube! + ((turns[b].cube! - turns[a].cube!) * (i - a)) / (b - a)
    return a >= 0 ? turns[a].cube! + clock[i] - clock[a] : turns[b].cube! - (clock[b] - clock[i])
  })
}

/**
 * Milliseconds from the first turn to each one. A cube's clock is steadier than Bluetooth, but runs
 * a little fast or slow, so it's fitted to this computer's over the turns that have both, the way
 * csTimer does it. Without a cube clock, or with one that's way off, it's this computer's times.
 */
export function elapsed(turns: Turn[]): number[] {
  const clock = turns.map((t) => t.host ?? t.at)
  const ours = clock.map((t) => t - clock[0])
  if (turns.filter((t) => t.cube !== null).length < 2) return ours
  const theirs = fill(turns)
  const pairs = turns.flatMap((t, i) => (t.host === null ? [] : [[theirs[i], t.host] as const]))
  let slope = 1
  if (pairs.length >= 4) {
    const n = pairs.length
    const mx = pairs.reduce((s, [x]) => s + x, 0) / n
    const my = pairs.reduce((s, [, y]) => s + y, 0) / n
    const vx = pairs.reduce((s, [x]) => s + (x - mx) ** 2, 0)
    const fit = pairs.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0) / vx
    // over a second or more, and only for the small drift of a real clock
    if (vx > 0 && pairs.at(-1)![0] - pairs[0][0] >= 1000 && Math.abs(fit - 1) < 0.05) slope = fit
  }
  const out = theirs.map((t) => (t - theirs[0]) * slope)
  const a = out.at(-1)!
  const b = ours.at(-1)!
  if (out.some((t, i) => i && t < out[i - 1] - 1) || Math.abs(a - b) > Math.max(300, b * 0.25)) return ours
  return out
}

/** A case's key for a cube that has the first two layers whole on the way through a solve. For a ZBLS, only while the edges still aren't oriented. */
function wayKey(cube: Cube, slot: boolean): string | null {
  const top = topOf(cube)
  if (top === null) return null
  if (!slot) return caseKey(top)
  return edgesOriented(top) ? null : caseKey(slotOf(cube)!)
}

const solvedKey = caseKey(SOLVED_LL)
const through = new Map<string, Set<string>>()

/**
 * The cases a case's own algorithms pass through partway. About one in nine ZBLL algorithms is two
 * shorter ones, a Sune and then another, so passing through a case on the way isn't a slip in itself.
 */
function passes(c: Case, texts: string[]): Set<string> {
  const id = `${c.id}\n${texts.join('\n')}`
  const hit = through.get(id)
  if (hit) return hit
  const slot = isSlot(c.ll)
  const keys = new Set<string>()
  for (const text of texts) {
    let moves: string[]
    try {
      moves = plain(text)
    } catch {
      continue
    }
    let cube = cubeAfter(undo(moves).join(' '))
    const add = (x: Cube) => {
      const key = wayKey(x, slot)
      if (key) keys.add(key)
    }
    moves.forEach((m, i) => {
      // a cube sends a half turn as two quarter turns, either way round, and halfway can be another case
      if (m.endsWith('2')) [m[0], m[0] + "'"].forEach((q) => add(turned(cube, q)))
      cube = turned(cube, m)
      if (i < moves.length - 1) add(cube)
    })
  }
  through.set(id, keys)
  return keys
}

/** Turns of the top at either end don't change what was done. */
const trim = (moves: string[]) => {
  let a = 0
  let b = moves.length
  while (a < b && moves[a][0] === 'U') a++
  while (b > a && moves[b - 1][0] === 'U') b--
  return moves.slice(a, b)
}

/** Turns about one axis in whichever order, as R L′ is the same as L′ R. */
function canon(moves: string[]): string {
  const out: string[] = []
  for (let i = 0; i < moves.length; ) {
    let j = i + 1
    const ax = 'UD'.includes(moves[i][0]) ? 0 : 'RL'.includes(moves[i][0]) ? 1 : 2
    while (j < moves.length && ('UD'.includes(moves[j][0]) ? 0 : 'RL'.includes(moves[j][0]) ? 1 : 2) === ax) j++
    out.push(...moves.slice(i, j).sort())
    i = j
  }
  return out.join(' ')
}

/** The algorithm the turns were, if it was one of these, however the cube was held. */
export function which(moves: string[], texts: string[]): string | null {
  const mine = canon(trim(tidy(moves)))
  if (!mine) return null
  for (const text of texts)
    for (const k of [0, 1, 2, 3]) {
      try {
        if (canon(trim(plain('y '.repeat(k) + text))) === mine) return text
      } catch {
        break
      }
    }
  return null
}

export interface Solve {
  /** Hundredths from the case being on the cube to the end. */
  cs: number
  /** Hundredths of it before the first turn: recognizing the case. */
  look: number
  /** Turns, counted the way algorithms are. */
  turns: number
  /** Which of the case's algorithms it was, if it was one. */
  alg: string | null
  /** It went through another case on the way, so a wrong algorithm was done. */
  astray: boolean
}

/**
 * A solve of a case: `start` is the turn that put the case on the cube, `from` the cube then, and
 * `turns` everything after, to the end. `texts` are the case's algorithms, the ones to look for first.
 */
export function read(c: Case, start: Turn, turns: Turn[], from: Cube, texts: string[]): Solve {
  const ms = elapsed([start, ...turns])
  const slot = isSlot(c.ll)
  const allowed = passes(c, texts)
  const startKey = slot ? null : caseKey(c.ll)
  let cube = from
  let astray = false
  for (const t of turns.slice(0, -1)) {
    cube = turned(cube, t.move)
    const key = wayKey(cube, slot)
    if (key && key !== startKey && key !== solvedKey && !allowed.has(key)) astray = true
  }
  const moves = turns.map((t) => t.move)
  return {
    cs: Math.round(ms.at(-1)! / 10),
    look: turns.length ? Math.round(ms[1] / 10) : 0,
    turns: tidy(moves).length,
    alg: which(moves, texts),
    astray,
  }
}
