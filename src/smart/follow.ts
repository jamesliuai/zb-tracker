/**
 * A smart cube through one thing to time: a scramble and then a solve in the trainer, a setup and
 * then an algorithm in Time it. It waits for a solved cube, follows the moves that set things up,
 * starts the clock, and says when it's over.
 */
import { useEffect, useRef, useState } from 'react'
import { isSolved, type Cube } from '../cube/engine.ts'
import { getData, setPrefs } from '../state/store.ts'
import { link, live, onTurn } from './connect.ts'
import { arrived, guide, step, type Guide } from './guide.ts'
import type { Turn } from './solve.ts'

export interface Plan {
  /** Something else to set up when this changes. */
  key: unknown
  /** The turns that set it up from solved, as written for whoever holds the cube. */
  moves: string
  /** The clock starts the moment it's set up, or at the first turn after. */
  start: 'set' | 'first'
  /** Whether it's done. */
  over: (cube: Cube) => boolean
}

export type Now =
  /** No cube, or nothing to time. */
  | { is: 'off' }
  /** The cube has to be solved before it can be set up. */
  | { is: 'wait' }
  | { is: 'setup'; guide: Guide }
  /** Set up, and the first turn starts the clock. */
  | { is: 'ready' }
  /** On the clock: from the turn it started at, with the cube then, and every turn since. */
  | { is: 'solve'; start: Turn; from: Cube; turns: Turn[] }

interface Hands {
  /** Start the clock at this time, by performance.now. */
  begin: (t: number) => void
  /** It's over. */
  end: (start: Turn, turns: Turn[], from: Cube) => void
}

const fresh = (plan: Plan, cube: Cube): Now => (isSolved(cube) ? { is: 'setup', guide: guide(plan.moves, getData().prefs.front) } : { is: 'wait' })

/** `plan` is read whenever the cube turns, so it's never behind, even between renders. */
export function useFollow(plan: () => Plan | null, hands: Hands) {
  const at = useRef<{ key: unknown; now: Now }>({ key: undefined, now: { is: 'off' } })
  const [now, show] = useState<Now>(at.current.now)
  const o = useRef({ plan, hands })
  o.current = { plan, hands }
  const on = link.use().state === 'on'

  const put = (key: unknown, n: Now) => {
    at.current = { key, now: n }
    show(n)
  }
  /** Where things stand, starting over when there's something else to set up. */
  const current = (cube: Cube): [Plan | null, Now] => {
    const p = o.current.plan()
    if (!p || link.get().state !== 'on') {
      if (at.current.now.is !== 'off') put(undefined, { is: 'off' })
      return [null, at.current.now]
    }
    if (at.current.key !== p.key || at.current.now.is === 'off') put(p.key, fresh(p, cube))
    return [p, at.current.now]
  }

  /** It's over. That may bring something else to set up, so whatever's next starts from scratch. */
  const finish = (cube: Cube, end: () => void) => {
    at.current = { key: undefined, now: { is: 'off' } }
    end()
    current(cube)
  }

  const key = plan()?.key
  useEffect(() => void current(live.get()), [key, on])

  useEffect(
    () =>
      onTurn((t, cube, before) => {
        const [p, n] = current(before)
        if (!p) return
        // marked solved, or its stickers read again
        if (!t) {
          if (n.is === 'wait' || n.is === 'setup') put(p.key, fresh(p, cube))
          return
        }
        if (n.is === 'wait') {
          if (isSolved(cube)) put(p.key, fresh(p, cube))
        } else if (n.is === 'setup') {
          // back to solved, so start again from the top
          if (isSolved(cube)) return put(p.key, fresh(p, cube))
          const g = step(n.guide, t.move)
          const k = arrived(g, cube)
          if (k === null) return put(p.key, { is: 'setup', guide: g })
          if (k !== getData().prefs.front) setPrefs({ front: k })
          if (p.start === 'first') return put(p.key, { is: 'ready' })
          put(p.key, { is: 'solve', start: t, from: cube, turns: [] })
          o.current.hands.begin(t.host ?? t.at)
        } else if (n.is === 'ready') {
          o.current.hands.begin(t.host ?? t.at)
          if (!p.over(cube)) return put(p.key, { is: 'solve', start: t, from: before, turns: [] })
          finish(cube, () => o.current.hands.end(t, [], before))
        } else if (n.is === 'solve') {
          const turns = [...n.turns, t]
          // nothing on screen changes with each turn of a solve, so it's kept without drawing anything
          if (!p.over(cube)) return void (at.current = { key: p.key, now: { ...n, turns } })
          finish(cube, () => o.current.hands.end(n.start, turns, n.from))
        }
      }),
    [],
  )

  /** The clock was called off, so whatever's on the cube needs solving again first. */
  const reset = () => {
    const p = o.current.plan()
    if (p && link.get().state === 'on') put(p.key, fresh(p, live.get()))
  }

  return { now, reset }
}
