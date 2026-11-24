import raw from './zbll.json' with { type: 'json' }
import { caseKey, type Turn } from '../cube/engine.ts'

export type Hand = 'two' | 'oh'

export interface Alg {
  /** U turns to do first, seen from the picture as printed. */
  auf: Turn
  text: string
}

export interface Case {
  id: string
  set: string
  sub: string
  /** 1-based position inside its subset. */
  n: number
  ll: string
  algs: Record<Hand, { main: Alg[]; more: Alg[] }>
}

export interface Subset {
  id: string
  set: string
  n: number
  name: string
  cases: Case[]
}

export interface ZSet {
  id: string
  name: string
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

const algs = (list: string[] = []): Alg[] => list.map((s) => ({ auf: Number(s[0]) as Turn, text: s.slice(1) }))

export const sets: ZSet[] = (raw as { id: string; name: string; subs: { id: string; name: string; cases: RawCase[] }[] }[]).map((s) => {
  const subs = s.subs.map((sub, si): Subset => ({
    id: sub.id,
    set: s.id,
    n: si + 1,
    name: sub.name,
    cases: sub.cases.map((c, i) => ({
      id: `${sub.id}-${i + 1}`,
      set: s.id,
      sub: sub.id,
      n: i + 1,
      ll: c.ll,
      algs: {
        two: { main: algs(c.two), more: algs(c.two2) },
        oh: { main: algs(c.oh), more: algs(c.oh2) },
      },
    })),
  }))
  return { id: s.id, name: s.name, subs, cases: subs.flatMap((x) => x.cases) }
})

export const subsets = sets.flatMap((s) => s.subs)
export const cases = sets.flatMap((s) => s.cases)
export const TOTAL = cases.length

export const setById = new Map(sets.map((s) => [s.id, s]))
export const subById = new Map(subsets.map((s) => [s.id, s]))
export const caseById = new Map(cases.map((c) => [c.id, c]))
export const caseByKey = new Map(cases.map((c) => [caseKey(c.ll), c]))
