/**
 * A small sticker-level 3x3 simulator.
 *
 * It answers two questions: does this algorithm solve this case (and after which AUF), and which
 * case does this algorithm solve. A last layer is a 21 character string:
 *
 *   0-8   top face, back row first        U = yellow
 *   9-11  back strip, left to right       F R B L = the four side colors
 *   12-14 right strip, back to front
 *   15-17 front strip, left to right
 *   18-20 left strip, back to front
 *
 * A ZBLS case is the last layer and the front right slot under it, 26 characters:
 *
 *   0-20  the last layer as above, but X wherever its own pieces aren't yellow, and X for all of
 *         its corners. Only the yellow on its edges matters.
 *   21-22 the slot's edge, front then right   F R = the colors of the slot, D = white
 *   23-25 the slot's corner, front, right, bottom
 */
export type Turn = 0 | 1 | 2 | 3

export const AUF = ['', 'U', 'U2', "U'"] as const

type Vec = readonly [number, number, number]
type Perm = Uint8Array

const key = (p: Vec, n: Vec) => `${p}|${n}`

const stickers: { p: Vec; n: Vec }[] = []
const indexOf = new Map<string, number>()
for (let x = -1; x <= 1; x++)
  for (let y = -1; y <= 1; y++)
    for (let z = -1; z <= 1; z++) {
      const p: Vec = [x, y, z]
      p.forEach((v, axis) => {
        if (!v) return
        const n: [number, number, number] = [0, 0, 0]
        n[axis] = v
        indexOf.set(key(p, n), stickers.length)
        stickers.push({ p, n })
      })
    }
const N = stickers.length
const identity = (): Perm => Uint8Array.from({ length: N }, (_, i) => i)
const at = (p: Vec, n: Vec) => indexOf.get(key(p, n))!

/** Clockwise quarter turns seen from +x, +y, +z. */
const spin: Record<string, (v: Vec) => Vec> = {
  x: ([a, b, c]) => [a, c, -b],
  y: ([a, b, c]) => [-c, b, a],
  z: ([a, b, c]) => [b, -a, c],
}

/** face: [axis, layers, clockwise quarter turns] */
const faces: Record<string, [string, number[], number]> = {
  R: ['x', [1], 1], L: ['x', [-1], 3], M: ['x', [0], 3], r: ['x', [0, 1], 1], l: ['x', [-1, 0], 3], x: ['x', [-1, 0, 1], 1],
  U: ['y', [1], 1], D: ['y', [-1], 3], E: ['y', [0], 3], u: ['y', [0, 1], 1], d: ['y', [-1, 0], 3], y: ['y', [-1, 0, 1], 1],
  F: ['z', [1], 1], B: ['z', [-1], 3], S: ['z', [0], 1], f: ['z', [0, 1], 1], b: ['z', [-1, 0], 3], z: ['z', [-1, 0, 1], 1],
}

/** Do p, then q. perm[i] is where the sticker at i ends up. */
const then = (p: Perm, q: Perm): Perm => p.map((i) => q[i])
const invert = (p: Perm): Perm => {
  const out = new Uint8Array(N)
  p.forEach((v, i) => (out[v] = i))
  return out
}

const moves = new Map<string, Perm>()
for (const [face, [axis, layers, turns]] of Object.entries(faces)) {
  const a = 'xyz'.indexOf(axis)
  const quarter = identity()
  stickers.forEach(({ p, n }, i) => {
    if (layers.includes(p[a])) quarter[i] = at(spin[axis](p), spin[axis](n))
  })
  let p = identity()
  for (let i = 0; i < turns; i++) p = then(p, quarter)
  moves.set(face, p)
  moves.set(face + '2', then(p, p))
  moves.set(face + "'", then(then(p, p), p))
}

/* ------------------------------------------------------------------ notation */

export class NotationError extends Error {
  readonly near: string
  constructor(near: string) {
    super(`Can’t read “${near}”`)
    this.near = near
  }
}

const token = /^([UDRLFBMESudrlfbxyz])([23]?)('?)/

/** Curly quotes, primes and odd spaces become plain ASCII. */
export const normalize = (text: string) =>
  text
    .replace(/[‘’′`´]/g, "'")
    .replace(/[  ]/g, ' ')
    .replace(/[​‌]/g, '')

/** Text to moves. "(R l)" is just a grouping, "L / r" means either so the first is used. */
export function parse(text: string): string[] {
  let s = normalize(text)
    .split(/\s\/\s*/)[0]
    .replace(/[(),]/g, ' ')
  const out: string[] = []
  while ((s = s.trimStart())) {
    const m = token.exec(s)
    if (!m) throw new NotationError(s.split(/\s/)[0].slice(0, 8))
    const n = m[2] ? Number(m[2]) : 1
    const turns = m[3] ? (4 - n) % 4 : n
    out.push(m[1] + (turns === 1 ? '' : turns === 2 ? '2' : "'"))
    s = s.slice(m[0].length)
  }
  return out
}

/** Turns in an algorithm. Slices count once and whole-cube rotations don't count. */
export const moveCount = (text: string) => parse(text).filter((m) => !'xyz'.includes(m[0])).length

/* ------------------------------------------------------------------ positions */

const permOf = (list: string[]): Perm => list.reduce((p, m) => then(p, moves.get(m)!), identity())

const rotations: { word: string[]; perm: Perm }[] = []
for (const a of [[], ['x'], ['x2'], ["x'"], ['z'], ["z'"]])
  for (const b of [[], ['y'], ['y2'], ["y'"]]) rotations.push({ word: [...a, ...b], perm: permOf([...a, ...b]) })

const centers = stickers.flatMap(({ p }, i) => (Math.abs(p[0]) + Math.abs(p[1]) + Math.abs(p[2]) === 1 ? [i] : []))

/** Undo whatever whole-cube rotation the algorithm leaves behind. */
function upright(p: Perm): Perm {
  for (const { perm } of rotations) {
    const q = then(p, perm)
    if (centers.every((c) => q[c] === c)) return q
  }
  return p
}

/**
 * Moves that take a solved cube to the position `text` solves, followed by `turns` U turns.
 * If the algorithm leaves the cube held differently, the setup starts from that grip.
 */
export function setup(text: string, turns = 0): string {
  const list = parse(text)
  const p = permOf(list)
  const grip = rotations.find(({ perm }) => centers.every((c) => perm[c] === p[c]))?.word ?? []
  const auf = AUF[((turns % 4) + 4) % 4]
  return tidy([...grip, ...undo(list), ...(auf ? [auf] : [])]).join(' ')
}

/** The moves that take back `list`. */
export const undo = (list: string[]) => [...list].reverse().map((m) => (m.endsWith('2') ? m : m.endsWith("'") ? m.slice(0, -1) : m + "'"))

const amount = (m: string) => (m.endsWith('2') ? 2 : m.endsWith("'") ? 3 : 1)
const suffix = ['', '', '2', "'"]
const axisOf = (letter: string) => faces[letter][0]

/**
 * Cancel turns of the same face, such as a grip rotation that meets its opposite. Turns about one
 * axis can swap places, so U D U′ is just D.
 */
export function tidy(list: string[]): string[] {
  const out: string[] = []
  for (const m of list) {
    let i = out.length - 1
    while (i >= 0 && out[i][0] !== m[0] && axisOf(out[i][0]) === axisOf(m[0])) i--
    if (i >= 0 && out[i][0] === m[0]) {
      const n = (amount(out[i]) + amount(m)) % 4
      if (n) out[i] = m[0] + suffix[n]
      else out.splice(i, 1)
    } else out.push(m)
  }
  return out
}

const normals: Record<string, Vec> = { R: [1, 0, 0], L: [-1, 0, 0], U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1] }

/**
 * The same algorithm in turns of the six faces alone, with the cube held one way throughout.
 * A slice or wide turn is the outer faces it leaves behind, plus a rotation, and a rotation only
 * changes which face each later turn lands on.
 */
export function plain(text: string): string[] {
  // which face, as the cube started, is now facing each way
  let at: Record<string, string> = { R: 'R', L: 'L', U: 'U', D: 'D', F: 'F', B: 'B' }
  const out: string[] = []
  const turn = (side: string, n: number) => {
    const k = ((n % 4) + 4) % 4
    if (k) out.push(at[side] + suffix[k])
  }
  for (const m of parse(text)) {
    const [axis, layers, unit] = faces[m[0]]
    const n = (unit * amount(m)) % 4 // quarter turns, clockwise seen from the + end of the axis
    const plus = 'RUF'['xyz'.indexOf(axis)]
    const minus = 'LDB'['xyz'.indexOf(axis)]
    if (layers.length === 1 && layers[0]) {
      if (layers[0] > 0) turn(plus, n)
      else turn(minus, -n)
      continue
    }
    if (!layers.includes(1)) turn(plus, -n)
    if (!layers.includes(-1)) turn(minus, n)
    const next = { ...at }
    for (const [side, v] of Object.entries(normals)) {
      let w = v
      for (let i = 0; i < n; i++) w = spin[axis](w)
      next[faceName(w)] = at[side]
    }
    at = next
  }
  return tidy(out)
}

const faceName = (n: Vec) => (n[1] === 1 ? 'U' : n[1] === -1 ? 'D' : n[2] === 1 ? 'F' : n[2] === -1 ? 'B' : n[0] === 1 ? 'R' : 'L')
const solved = stickers.map(({ n }) => faceName(n))

const three = [-1, 0, 1]
const llSlots: number[] = [
  ...three.flatMap((z) => three.map((x) => at([x, 1, z], [0, 1, 0]))),
  ...three.map((x) => at([x, 1, -1], [0, 0, -1])),
  ...three.map((z) => at([1, 1, z], [1, 0, 0])),
  ...three.map((x) => at([x, 1, 1], [0, 0, 1])),
  ...three.map((z) => at([-1, 1, z], [-1, 0, 0])),
]
const isLL = new Set(llSlots)
const rest = stickers.flatMap((_, i) => (isLL.has(i) ? [] : [i]))

const slotSlots = [at([1, 0, 1], [0, 0, 1]), at([1, 0, 1], [1, 0, 0]), at([1, -1, 1], [0, 0, 1]), at([1, -1, 1], [1, 0, 0]), at([1, -1, 1], [0, -1, 0])]
const inSlot = new Set(slotSlots)
/** Everything a ZBLS algorithm has to leave where it was. */
const below = rest.filter((i) => !inSlot.has(i))
const pieces = (() => {
  const by = new Map<string, number[]>()
  stickers.forEach(({ p }, i) => by.set(String(p), [...(by.get(String(p)) ?? []), i]))
  return [...by.values()].filter((list) => list.length > 1)
})()

/** True for the picture of a ZBLS case, false for a last layer. */
export const isSlot = (ll: string) => ll.length > 21

/** A cube as a ZBLS picture: the last layer's pieces only say where an edge's yellow is. */
function slotPicture(state: string[]): string {
  const out = [...state]
  for (const piece of pieces) if (piece.some((i) => state[i] === 'U')) for (const i of piece) out[i] = piece.length === 2 && state[i] === 'U' ? 'U' : 'X'
  return [...llSlots, ...slotSlots].map((i) => out[i]).join('')
}

const sides = 'FRBL'
const recolor = (ll: string, k: number) =>
  ll.replace(/[FRBL]/g, (c) => sides[(sides.indexOf(c) + k) % 4])

/** The same case whatever the final AUF is. */
const anyColoring = (ll: string) => [0, 1, 2, 3].map((k) => recolor(ll, k)).sort()[0]

/** Where each sticker of the picture goes under one clockwise U turn. */
const afterU: number[] = (() => {
  const to: number[] = []
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) to.push(c * 3 + 2 - r)
  for (let t = 0; t < 3; t++) {
    to[9 + t] = 12 + t // back to right
    to[12 + t] = 15 + (2 - t) // right to front
    to[15 + t] = 18 + t // front to left
    to[18 + t] = 9 + (2 - t) // left to back
  }
  return to
})()

/** The picture after k clockwise U turns. A ZBLS slot stays where it is. */
export function turnU(ll: string, k: number): string {
  let s = ll
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) {
    const out: string[] = []
    for (let j = 0; j < 21; j++) out[afterU[j]] = s[j]
    s = out.join('') + s.slice(21)
  }
  return s
}

/** The same case seen any way. A ZBLS case only turns, as its colors are fixed by the slot. */
const sameCase = (ll: string) => (isSlot(ll) ? (k: number) => turnU(ll, k) : (k: number) => anyColoring(turnU(ll, k)))
const canonical = (ll: string) => [0, 1, 2, 3].map(sameCase(ll)).sort()[0]

/** The quarter turns that take the picture `ll` to the one `seen` on a cube, whatever its colors. Null if it's another case. */
export function viewOf(ll: string, seen: string): Turn | null {
  const want = isSlot(ll) ? seen : anyColoring(seen)
  return ([0, 1, 2, 3] as Turn[]).find((k) => sameCase(ll)(k) === want) ?? null
}

/** The whole cube, sticker by sticker, in the position an algorithm solves. */
function solvedBy(text: string): string[] {
  const back = invert(upright(permOf(parse(text))))
  const state: string[] = []
  for (let i = 0; i < N; i++) state[back[i]] = solved[i]
  return state
}

/** The whole cube after doing `text` on a solved one. */
function doneOn(text: string): string[] {
  const p = permOf(parse(text))
  const state: string[] = []
  for (let i = 0; i < N; i++) state[p[i]] = solved[i]
  return state
}

const keeps = (state: string[], list: number[]) => list.every((i) => state[i] === solved[i])
const layerOf = (state: string[]) => llSlots.map((i) => state[i]).join('')

/** The last layer after doing `text` on a solved cube, or null if F2L or the grip changed. */
export function layerAfter(text: string): string | null {
  const state = doneOn(text)
  return keeps(state, rest) ? layerOf(state) : null
}

/** The ZBLS case after doing `text` on a solved cube, or null if more than the last slot or the grip changed. */
export function slotAfter(text: string): string | null {
  const state = doneOn(text)
  return keeps(state, below) ? slotPicture(state) : null
}

const cache = new Map<string, Turn[]>()

/** The AUFs (clockwise U turns done first) after which `text` solves `ll`. Empty if it never does. */
export function solves(text: string, ll: string): Turn[] {
  const id = `${ll}:${text}`
  const hit = cache.get(id)
  if (hit) return hit
  const state = solvedBy(text)
  let out: Turn[] = []
  if (isSlot(ll)) {
    const target = keeps(state, below) && slotPicture(state)
    if (target) out = ([0, 1, 2, 3] as Turn[]).filter((k) => turnU(ll, k) === target)
  } else if (keeps(state, rest)) {
    const target = anyColoring(layerOf(state))
    out = ([0, 1, 2, 3] as Turn[]).filter((k) => anyColoring(turnU(ll, k)) === target)
  }
  cache.set(id, out)
  return out
}

export type Verdict = { kind: 'layer' | 'slot'; key: string } | { kind: 'breaks-f2l' } | { kind: 'does-nothing' }

const oriented = (layer: string) => [1, 3, 5, 7].every((i) => layer[i] === 'U')

/**
 * What an algorithm does, with a key that can be looked up against known cases. Keeping the first two
 * layers and solving a last layer whose edges are oriented makes it a last layer algorithm. Orienting
 * the edges, with or without putting in the front right pair, makes it a ZBLS.
 */
export function examine(text: string): Verdict {
  const state = solvedBy(text)
  if (keeps(state, rest)) {
    const layer = layerOf(state)
    if (!oriented(layer)) return { kind: 'slot', key: canonical(slotPicture(state)) }
    const k = canonical(layer)
    return k === canonical(layerOf(solved)) ? { kind: 'does-nothing' } : { kind: 'layer', key: k }
  }
  return keeps(state, below) ? { kind: 'slot', key: canonical(slotPicture(state)) } : { kind: 'breaks-f2l' }
}

export const caseKey = canonical
