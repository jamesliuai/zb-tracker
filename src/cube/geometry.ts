/** Where the 21 stickers of a last layer picture sit, in a 100 by 100 drawing. */
export interface Box {
  x: number
  y: number
  w: number
  h: number
  r: number
}

const FACE = 12.4 // top face inset
const GAP = 2.4
const CELL = (100 - FACE * 2 - GAP * 2) / 3
const BAR = 6.6 // side strip thickness
const BAR_IN = 3 // side strip inset from the edge of the drawing
const along = (i: number) => FACE + i * (CELL + GAP)
const far = 100 - BAR_IN - BAR

const three = [0, 1, 2]
export const slots: Box[] = [
  ...three.flatMap((row) => three.map((col) => ({ x: along(col), y: along(row), w: CELL, h: CELL, r: 4.4 }))),
  ...three.map((i) => ({ x: along(i), y: BAR_IN, w: CELL, h: BAR, r: 2.4 })), // back
  ...three.map((i) => ({ x: far, y: along(i), w: BAR, h: CELL, r: 2.4 })), // right
  ...three.map((i) => ({ x: along(i), y: far, w: CELL, h: BAR, r: 2.4 })), // front
  ...three.map((i) => ({ x: BAR_IN, y: along(i), w: BAR, h: CELL, r: 2.4 })), // left
]

/** The same layout drawn bolder, for small icons. */
const inset = 19
const gap = 4
const cell = (100 - inset * 2 - gap * 2) / 3
const bar = 11
const line = (i: number) => inset + i * (cell + gap)
export const bold: Box[] = [
  ...three.flatMap((row) => three.map((col) => ({ x: line(col), y: line(row), w: cell, h: cell, r: 4.5 }))),
  ...three.map((i) => ({ x: line(i), y: 2, w: cell, h: bar, r: 3.6 })),
  ...three.map((i) => ({ x: 98 - bar, y: line(i), w: bar, h: cell, r: 3.6 })),
  ...three.map((i) => ({ x: line(i), y: 98 - bar, w: cell, h: bar, r: 3.6 })),
  ...three.map((i) => ({ x: 2, y: line(i), w: bar, h: cell, r: 3.6 })),
]

const pieces = [
  [0, 9, 18], [2, 11, 12], [6, 15, 20], [8, 17, 14], // corners
  [1, 10], [5, 13], [7, 16], [3, 19], // edges
  [4],
]
export const SOLVED_LL = 'UUUUUUUUUBBBRRRFFFLLL'
/** A ZBLS case done: the pair in, and every edge on top yellow side up. The rest is for the ZBLL. */
export const SOLVED_SLOT = 'XUXUUUXUX' + 'X'.repeat(12) + 'FRFRD'

/** For each sticker of a case, the slot it belongs in once the case is solved. */
export function homes(ll: string): number[] {
  const out: number[] = []
  const colors = (p: number[], s: string) => p.map((i) => s[i]).sort().join('')
  for (const piece of pieces) {
    const home = pieces.find((q) => colors(q, SOLVED_LL) === colors(piece, ll))
    for (const i of piece) out[i] = home ? home.find((j) => SOLVED_LL[j] === ll[i])! : i
  }
  return out
}

/** True where the top face already shows yellow. */
export const oriented = (ll: string) => three.flatMap((r) => three.map((c) => ll[r * 3 + c] === 'U'))

/* ------------------------------------------------------------------ ZBLS, from above the front right corner */

const SIDE = 16 // a sticker and its gap, along an edge of the cube
const COS = Math.cos(Math.PI / 6)
const matrix = (m: number[]) => `matrix(${m.map((n) => +n.toFixed(3)).join(' ')})`
/**
 * Each face drawn as a 3 by 3 grid centered on 0, a sticker apart, then laid onto the cube. The
 * top is seen from above with the back row first, and the sides as they face you.
 */
export const faces = {
  U: matrix([SIDE * COS, SIDE / 2, -SIDE * COS, SIDE / 2, 50, 50 - 1.5 * SIDE]),
  F: matrix([SIDE * COS, SIDE / 2, 0, SIDE, 50 - 1.5 * SIDE * COS, 50 + 0.75 * SIDE]),
  R: matrix([SIDE * COS, -SIDE / 2, 0, SIDE, 50 + 1.5 * SIDE * COS, 50 + 0.75 * SIDE]),
}
/** A sticker in its face's grid. Small icons want a wider gap. */
export const facet = (row: number, col: number, gap = 0.11) => ({ x: col - 1.5 + gap / 2, y: row - 1.5 + gap / 2, w: 1 - gap, h: 1 - gap, r: 0.19 })

/**
 * Which character of a ZBLS picture each sticker of the front and right faces shows, row by row, or
 * the face's own color where the first two layers are always solved. The top row comes from the
 * picture turned the way it's seen, as the top turns.
 */
export const front = [15, 16, 17, 'F', 'F', 21, 'F', 'F', 23] as const
export const right = [14, 13, 12, 22, 'R', 'R', 24, 'R', 'R'] as const

/* ------------------------------------------------------------------ arrows */

type Point = readonly [number, number]
const mid = (i: number): Point => [slots[i].x + slots[i].w / 2, slots[i].y + slots[i].h / 2]
const toward = ([ax, ay]: Point, [bx, by]: Point, d: number): Point => {
  const k = d / Math.hypot(bx - ax, by - ay)
  return [ax + (bx - ax) * k, ay + (by - ay) * k]
}
const at = ([x, y]: Point) => `${x.toFixed(2)} ${y.toFixed(2)}`

const BEND = 11 // how far an arrow along a side is pulled out, to stay clear of the edge it passes
const HEAD = 6.6 // the point itself, which its outline makes a little bigger
const HALF = 3.5
const NEAR = 3.4 // how far from the middle of a sticker a point stops
const FAR = 6.4 // and a tail starts, so one arrow can leave where another arrives

/** A pointed end at `tip`, coming from `from`. */
function head(tip: Point, from: Point): string {
  const back = toward(tip, from, HEAD)
  const [nx, ny] = [((tip[1] - back[1]) / HEAD) * HALF, ((back[0] - tip[0]) / HEAD) * HALF]
  return `M${at(tip)}L${at([back[0] + nx, back[1] + ny])}L${at([back[0] - nx, back[1] - ny])}Z`
}

export interface Arrow {
  line: string
  heads: string
}

function arrow(i: number, j: number, both: boolean): Arrow {
  const [a, b] = [mid(i), mid(j)]
  const m: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const corners = i % 2 === 0 && j % 2 === 0
  const along = a[0] === b[0] || a[1] === b[1]
  const c = corners && along ? toward(m, [50, 50], -BEND) : m
  const [p, q] = [toward(a, c, both ? NEAR : FAR), toward(b, c, NEAR)]
  // the line ends inside its head, so a blunt end never shows at the tip
  const [p2, q2] = [both ? toward(p, c, HEAD * 0.6) : p, toward(q, c, HEAD * 0.6)]
  return { line: `M${at(p2)}Q${at(c)} ${at(q2)}`, heads: head(q, c) + (both ? head(p, c) : '') }
}

/** Where the pieces go, when that's all there is to it. Nothing unless the whole top is yellow. */
export function arrows(ll: string): Arrow[] {
  if (!oriented(ll).every(Boolean)) return []
  const home = homes(ll)
  return pieces.flatMap(([i]) => {
    const to = home[i]
    const both = home[to] === i
    return to === i || (both && to < i) ? [] : [arrow(i, to, both)]
  })
}
