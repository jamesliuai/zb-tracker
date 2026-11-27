/**
 * Following moves on a smart cube, turn by turn: a scramble in the trainer, the setup in Time it.
 *
 * The cube reports turns with yellow on top, but which side faces you is up to you, so the guide
 * follows all four ways of holding it at once and shows the one your turns agree with. What's left
 * to do is a list, and each turn goes in front of it backwards, cancelling what it can. That one
 * rule covers a right turn, half of a half turn, the wrong way, the wrong face, and U and D done in
 * either order.
 */
import { cubeAfter, plain, sameCube, tidy, undo, type Cube } from '../cube/engine.ts'

/** Which side faces you, with yellow on top: quarter turns of the cube from the way it reports itself. */
export type Front = 0 | 1 | 2 | 3
export const FRONTS: Front[] = [0, 1, 2, 3]

const held = (k: Front) => 'y '.repeat(k)

/** For each way of holding the cube, what you'd call each face it reports. */
const named = FRONTS.map((k) => Object.fromEntries([...'URFDLB'].map((f) => [plain(held(k) + f)[0][0], f])))

/** A turn the cube reported, as you'd write it holding the cube that way. */
export const asHeld = (k: Front, move: string) => named[k][move[0]] + move.slice(1)

/** Moves as the cube would report them, done holding it that way. */
export const asReported = (k: Front, text: string) => plain(held(k) + text)

interface Way {
  /** What's left to do, as you'd write it. */
  left: string[]
  /** Turns that took you further from the end. */
  off: number
  /** The cube once it's all done. */
  end: Cube
}

export interface Guide {
  /** The moves, as written. */
  moves: string[]
  ways: Way[]
  /** The way of holding it that's shown. */
  front: Front
}

const quarters = (list: string[]) => list.reduce((n, m) => n + (m.endsWith('2') ? 2 : 1), 0)

/** Moves to follow from a solved cube, in turns of the faces. */
export function guide(text: string, front: Front = 0): Guide {
  const moves = text.split(' ').filter(Boolean)
  return { moves, ways: FRONTS.map((k) => ({ left: moves, off: 0, end: cubeAfter(asReported(k, text).join(' ')) })), front }
}

/** The guide after one more turn of the cube. Another way of holding it only takes over once it's clearly the one, so a slip doesn't turn everything around. */
export function step(g: Guide, move: string): Guide {
  const ways = g.ways.map((w, k) => {
    const left = tidy([...undo([asHeld(k as Front, move)]), ...w.left])
    return { ...w, left, off: w.off + (quarters(left) > quarters(w.left) ? 1 : 0) }
  })
  const best = FRONTS.reduce((a, b) => (ways[b].off < ways[a].off ? b : a), g.front)
  return { ...g, ways, front: ways[best].off + 2 <= ways[g.front].off ? best : g.front }
}

/** How it's held, once the cube is where the moves lead. Null until then. */
export function arrived(g: Guide, cube: Cube): Front | null {
  return [g.front, ...FRONTS].find((k) => sameCube(g.ways[k].end, cube)) ?? null
}

export interface Token {
  move: string
  /** Done; half done, for a half turn; a move to put a slip right; the next to do; or still to come. */
  is: 'done' | 'half' | 'fix' | 'next' | 'todo'
}

const axis = (m: string) => ('UD'.includes(m[0]) ? 'y' : 'RL'.includes(m[0]) ? 'x' : 'z')

/** The moves as they should look now. */
export function tokens(g: Guide): Token[] {
  const all = g.moves
  const left = g.ways[g.front].left
  // the longest end of the moves that's all still to do
  let j = all.length
  while (j > 0) {
    const n = all.length - j + 1
    if (left.length < n || left[left.length - n] !== all[j - 1]) break
    j--
  }
  const lead = left.slice(0, left.length - (all.length - j))
  // The end of that may belong to the turns about one axis just before, which can be U and D the
  // other way round, half of a half turn or the wrong way round. Whatever comes ahead of it is a slip to put right first.
  const ax = lead.length ? axis(lead.at(-1)!) : ''
  let r = j
  while (r > 0 && axis(all[r - 1]) === ax) r--
  const run = all.slice(r, j)
  let y = lead.length
  while (y > 0 && axis(lead[y - 1]) === ax) y--
  let own = lead.slice(y)
  const faces = own.map((m) => m[0])
  if (!run.length || new Set(faces).size < faces.length || !faces.every((f) => run.some((s) => s[0] === f))) {
    own = []
    y = lead.length
    r = j
  }
  const out: Token[] = all.slice(0, r).map((move) => ({ move, is: 'done' }))
  lead.slice(0, y).forEach((move) => out.push({ move, is: 'fix' }))
  for (const s of all.slice(r, j)) {
    const m = own.find((x) => x[0] === s[0])
    if (!m) out.push({ move: s, is: 'done' })
    else if (m === s) out.push({ move: s, is: 'todo' })
    else if (s.endsWith('2') && !m.endsWith('2')) out.push({ move: s, is: 'half' })
    else out.push({ move: m, is: 'fix' })
  }
  all.slice(j).forEach((move) => out.push({ move, is: 'todo' }))
  const first = out.findIndex((t) => t.is !== 'done')
  if (first >= 0 && out[first].is === 'todo') out[first] = { ...out[first], is: 'next' }
  return out
}
