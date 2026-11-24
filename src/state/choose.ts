import { solves, type Turn } from '../cube/engine.ts'
import type { Alg, Case, Hand } from '../data/index.ts'
import type { Angle, Entry } from './store.ts'

const effort = [0, 1, 2, 1]

/** The AUF needed before `text` when the picture has been turned by `rot`. Null if it never solves the case. */
export function need(c: Case, text: string, rot: Turn): Turn | null {
  const from = solves(text, c.ll).map((k) => ((k - rot + 4) % 4) as Turn)
  return from.length ? from.sort((a, b) => effort[a] - effort[b])[0] : null
}

export interface Pick {
  text: string
  need: Turn
  /** False while it's still the sheet's first suggestion. */
  picked: boolean
}

/** The algorithm an angle uses: the one picked, or the sheet's first choice. */
export function chosen(c: Case, angle: Angle, hand: Hand): Pick {
  if (angle.alg) {
    const n = need(c, angle.alg, angle.rot)
    if (n !== null) return { text: angle.alg, need: n, picked: true }
  }
  const text = c.algs[hand].main[0].text
  return { text, need: need(c, text, angle.rot) ?? 0, picked: false }
}

/**
 * A good second angle: the opposite side if some algorithm works from there with no AUF,
 * otherwise a side view.
 */
export function suggestAngle(c: Case, first: Angle, hand: Hand, own: string[] = []): Partial<Angle> {
  const used = chosen(c, first, hand).text
  const texts = [...own, ...c.algs[hand].main.map((a) => a.text), ...c.algs[hand].more.map((a) => a.text)].filter((t) => t !== used)
  for (const d of [2, 1, 3]) {
    const rot = ((first.rot + d) % 4) as Turn
    const alg = texts.find((t) => need(c, t, rot) === 0)
    if (alg) return { rot, alg }
  }
  return { rot: ((first.rot + 2) % 4) as Turn, alg: texts[0] ?? null }
}

export interface Row extends Alg {
  need: Turn
  own?: boolean
}

/** Everything on offer for a case, as seen from one angle. */
export function offers(c: Case, hand: Hand, rot: Turn, e: Entry): { main: Row[]; more: Row[] } {
  const row = (a: Alg): Row => ({ ...a, need: need(c, a.text, rot) ?? a.auf })
  const own = (e.own ?? []).flatMap((text): Row[] => {
    const n = need(c, text, rot)
    return n === null ? [] : [{ text, auf: n, need: n, own: true }]
  })
  return { main: [...own, ...c.algs[hand].main.map(row)], more: c.algs[hand].more.map(row) }
}
