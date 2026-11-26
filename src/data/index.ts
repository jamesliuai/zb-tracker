import pllJson from './pll.json' with { type: 'json' }
import zbllJson from './zbll.json' with { type: 'json' }
import zblsJson from './zbls.json' with { type: 'json' }
import { caseKey, type Turn } from '../cube/engine.ts'

export type Hand = 'two' | 'oh'
export type DeckId = 'ZBLL' | 'ZBLS' | 'PLL'

export interface Alg {
  /** U turns to do first, seen from the picture as printed. */
  auf: Turn
  text: string
  /** Who solves it this way. */
  by?: string
  /** How it's turned. */
  tip?: string
}

export interface Case {
  id: string
  deck: DeckId
  set: string
  sub: string
  /** 1-based position inside its subset. */
  n: number
  /** What it's called, and what it's called next to the rest of its subset. */
  name: string
  short: string
  /** Its picture: a last layer, or for ZBLS the last layer and the slot under it. See the engine. */
  ll: string
  algs: Record<Hand, { main: Alg[]; more: Alg[] }>
}

export interface Subset {
  id: string
  deck: DeckId
  set: string
  n: number
  /** Empty when it only has a number, as in ZBLS. */
  name: string
  short: string
  cases: Case[]
}

export interface ZSet {
  id: string
  deck: DeckId
  name: string
  short: string
  subs: Subset[]
  cases: Case[]
}

/** Everything you can switch to from the top left. */
export interface Deck {
  id: DeckId
  /** Small enough for one page. Its sets are parts of that page, with a single subset each. */
  flat: boolean
  /** With one-handed algorithms of its own. Without them, one hand gets the two-handed ones. */
  hands: boolean
  sets: ZSet[]
  subs: Subset[]
  cases: Case[]
}

interface RawCase {
  ll: string
  two: string[]
  oh: string[]
  two2?: string[]
  oh2?: string[]
}
interface RawPll extends RawCase {
  name: string
  /** How many of the first algorithms are Yiheng Wang's, and the fingertricks for them. */
  yiheng: number
  tips?: string[]
}
interface RawZbls {
  name: string
  ll: string
  two: string[]
  two2?: string[]
  /** Who uses each algorithm, or how many on solved.no. */
  by: string[]
  by2?: string[]
}

const algs = (list: string[] = [], by: string[] = []): Alg[] => list.map((s, i) => ({ auf: Number(s[0]) as Turn, text: s.slice(1), by: by[i] || undefined }))
const choices = (c: RawCase): Case['algs'] => ({
  two: { main: algs(c.two), more: algs(c.two2) },
  oh: { main: algs(c.oh), more: algs(c.oh2) },
})
const deck = (id: DeckId, flat: boolean, hands: boolean, sets: ZSet[]): Deck => ({ id, flat, hands, sets, subs: sets.flatMap((s) => s.subs), cases: sets.flatMap((s) => s.cases) })

const zbll = deck(
  'ZBLL',
  false,
  true,
  (zbllJson as { id: string; name: string; subs: { id: string; name: string; cases: RawCase[] }[] }[]).map((s) => {
    const of = { deck: 'ZBLL', set: s.id } as const
    const subs = s.subs.map((sub, si): Subset => ({
      ...of,
      id: sub.id,
      n: si + 1,
      name: sub.name,
      short: sub.id,
      cases: sub.cases.map((c, i) => {
        const id = `${sub.id}-${i + 1}`
        return { ...of, id, sub: sub.id, n: i + 1, name: id, short: String(i + 1), ll: c.ll, algs: choices(c) }
      }),
    }))
    return { deck: 'ZBLL', id: s.id, name: s.name, short: s.id, subs, cases: subs.flatMap((x) => x.cases) }
  }),
)

/**
 * Numbered F2L case by F2L case, the way speedcubingtips.eu and the ZBLS library number them. A
 * subset is one F2L case with its edges every way they can be, and 5-3 is the third of case 5.
 */
const zbls = deck(
  'ZBLS',
  false,
  false,
  (zblsJson as { id: string; tab: string; name: string; subs: { n: number; cases: RawZbls[] }[] }[]).map((s) => {
    const of = { deck: 'ZBLS', set: s.id } as const
    const subs = s.subs.map((sub, si): Subset => {
      const id = `ZBLS-${sub.n}`
      const cases = sub.cases.map((c, i): Case => {
        const two = { main: algs(c.two, c.by), more: algs(c.two2, c.by2) }
        return { ...of, id: `ZBLS-${c.name}`, sub: id, n: i + 1, name: c.name, short: String(i + 1), ll: c.ll, algs: { two, oh: two } }
      })
      return { ...of, id, n: si + 1, name: '', short: String(sub.n), cases }
    })
    return { deck: 'ZBLS', id: s.id, name: s.name, short: s.tab, subs, cases: subs.flatMap((x) => x.cases) }
  }),
)

const pll = deck(
  'PLL',
  true,
  true,
  (pllJson as { id: string; tab: string; name: string; cases: RawPll[] }[]).map((s) => {
    const of = { deck: 'PLL', set: s.id } as const
    const cases = s.cases.map((c, i): Case => {
      const list = choices(c)
      list.two.main.slice(0, c.yiheng).forEach((a, k) => Object.assign(a, { by: 'Yiheng', tip: c.tips?.[k] || undefined }))
      return { ...of, id: `PLL-${c.name}`, sub: s.id, n: i + 1, name: `${c.name} perm`, short: c.name, ll: c.ll, algs: list }
    })
    const sub: Subset = { ...of, id: s.id, n: 1, name: s.name, short: s.tab, cases }
    return { deck: 'PLL', id: s.id, name: s.name, short: s.tab, subs: [sub], cases }
  }),
)

export const decks: Deck[] = [zbll, zbls, pll]
export const sets = decks.flatMap((d) => d.sets)
export const subsets = decks.flatMap((d) => d.subs)
export const cases = decks.flatMap((d) => d.cases)

export const deckById = new Map(decks.map((d) => [d.id, d]))
export const setById = new Map(sets.map((s) => [s.id, s]))
export const subById = new Map(subsets.map((s) => [s.id, s]))
export const caseById = new Map(cases.map((c) => [c.id, c]))
export const caseByKey = new Map(cases.map((c) => [caseKey(c.ll), c]))
