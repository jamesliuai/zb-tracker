/**
 * One algorithm against the clock, again and again, to get it faster. Each algorithm keeps its own
 * fastest time and its latest ones, apart from how its case does in the trainer, where the time
 * includes knowing the case.
 */
import { drilling } from '../reward/signals.ts'
import { drillsOf, KEEP, setDrill, type Drill } from '../state/store.ts'

/** Time one algorithm of a case, over the whole page. */
export const drill = (id: string, text: string) => drilling.set({ id, text })

/** A time just done, and the record it replaced, so it can be taken back. */
export interface Lap {
  id: string
  text: string
  cs: number
  /** Faster than it had ever been done. The first time doesn't count, as there was nothing to beat. */
  best: boolean
  before: Drill | undefined
  after: Drill
}

/** A record with one more time in it. */
export function timed(d: Drill | undefined, cs: number, at = Date.now()): Drill {
  return { n: (d?.n ?? 0) + 1, times: [...(d?.times ?? []), cs].slice(-KEEP), best: Math.min(d?.best ?? cs, cs), at }
}

/** Save a time for an algorithm of a case. */
export function lap(id: string, text: string, cs: number): Lap {
  const before = drillsOf(id)[text]
  const after = timed(before, cs)
  setDrill(id, text, after)
  return { id, text, cs, best: before !== undefined && cs < before.best, before, after }
}

/** Take a time back, if nothing has changed the record since it was saved. */
export function unlap(l: Lap): boolean {
  if (drillsOf(l.id)[l.text] !== l.after) return false
  setDrill(l.id, l.text, l.before)
  return true
}

/** The average of the last n, without the fastest and the slowest of them, the way cubers average. Null until there are n. */
export function average(times: number[], n: number): number | null {
  if (times.length < n) return null
  const middle = times
    .slice(-n)
    .sort((a, b) => a - b)
    .slice(1, -1)
  return middle.reduce((a, b) => a + b, 0) / middle.length
}
