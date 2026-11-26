/**
 * What to train, and when each case should come back. Learning sticks best when you pull an
 * algorithm out of memory just as it starts to fade, so every case keeps a gap that grows each
 * time you get it and closes the moment you miss it.
 */
import type { Deck } from '../data/index.ts'
import { getData, KEEP, type Data, type Pool, type Practice } from '../state/store.ts'

export const DAY = 86_400_000
/** The most a round of what's due holds, about ten minutes with a cube. */
export const ROUND = 30

export const median = (list: number[]) => {
  const s = [...list].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * A case was practiced: got right in `cs` hundredths (null without a cube), or missed. Getting it
 * right spaces it out, a little less when it was slow for you. Practice before it's due doesn't
 * stretch the gap, so three rounds in an evening count as one review.
 */
export function practised(p: Practice | undefined, got: boolean, cs: number | null, now = Date.now()): Practice {
  const n = (p?.n ?? 0) + 1
  if (!got) return { ...p, n, miss: (p?.miss ?? 0) + 1, run: 0, at: now, due: now, days: 0 }
  const was = p?.days ?? 0
  const slow = cs !== null && (p?.times?.length ?? 0) >= 3 && cs > median(p!.times!) * 1.3
  const early = p !== undefined && now - p.at < was * DAY * 0.5
  const days = !was ? 1 : early ? was : Math.min(180, was * (slow ? 1.4 : 2.5))
  const out: Practice = { ...p, n, run: (p?.run ?? 0) + 1, at: now, due: now + days * DAY, days }
  if (cs !== null) {
    out.times = [...(p?.times ?? []), cs].slice(-KEEP)
    out.best = Math.min(p?.best ?? cs, cs)
  }
  return out
}

export interface Plan {
  ids: string[]
  /** For a round of what's due: how many of it you're learning, and how many are due but left for the next round. */
  learning: number
  later: number
}

/** The cases a round would hold, in the order the deck lists them. */
export function plan(deck: Deck, pool: Pool, pick: string[], { cases, practice }: Pick<Data, 'cases' | 'practice'> = getData(), now = Date.now()): Plan {
  const s = (id: string) => cases[id]?.s ?? 0
  if (pool !== 'due') {
    const want = new Set(pick)
    const ids = deck.cases.filter((c) => (pool === 'all' ? true : pool === 'pick' ? want.has(c.id) : s(c.id) === (pool === 'learning' ? 1 : 2))).map((c) => c.id)
    return { ids, learning: ids.filter((id) => s(id) === 1).length, later: 0 }
  }
  // everything you're learning, least recently practiced first
  const learning = deck.cases.filter((c) => s(c.id) === 1).sort((a, b) => (practice[a.id]?.at ?? 0) - (practice[b.id]?.at ?? 0))
  // then what you've learned, most overdue for its gap first, and last whatever was never practiced
  const urgency = (id: string) => {
    const p = practice[id]
    return p ? (now - p.due) / ((p.days || 1) * DAY) : -1
  }
  const due = deck.cases.filter((c) => s(c.id) === 2 && (practice[c.id]?.due ?? 0) <= now).sort((a, b) => urgency(b.id) - urgency(a.id))
  const all = [...learning, ...due].map((c) => c.id)
  const chosen = new Set(all.slice(0, ROUND))
  return { ids: deck.cases.filter((c) => chosen.has(c.id)).map((c) => c.id), learning: Math.min(learning.length, ROUND), later: all.length - chosen.size }
}

/** When the next learned case in a deck falls due, if none is due now. */
export function nextDue(deck: Deck, { cases, practice }: Pick<Data, 'cases' | 'practice'> = getData()): number | null {
  let soonest: number | null = null
  for (const c of deck.cases) {
    if (cases[c.id]?.s !== 2) continue
    const due = practice[c.id]?.due ?? 0
    if (soonest === null || due < soonest) soonest = due
  }
  return soonest
}
