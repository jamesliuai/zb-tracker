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
