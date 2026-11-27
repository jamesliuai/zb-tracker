/**
 * A round of training: every case in it once, in a shuffled order, with any you miss coming back a
 * few cases later. It lives outside the page, so you can look at a case and come back to the round.
 */
import type { Turn } from '../cube/engine.ts'
import { caseById, type DeckId } from '../data/index.ts'
import { signal } from '../reward/signals.ts'
import type { Solve } from '../smart/solve.ts'
import { practiceOf, setPractice, type Practice, type Way } from '../state/store.ts'
import { practised } from './schedule.ts'
import { scramble } from './scramble.ts'

/** The case coming up, and how it's put in front of you. */
export interface Prompt {
  id: string
  /** The scramble, when training with a cube. */
  moves: string | null
  view: Turn
}

export interface Attempt {
  id: string
  view: Turn
  /** Hundredths of a second. */
  cs: number
  missed: boolean
  /** Faster than any solve of it before. */
  best: boolean
  /** The case's record before this attempt, and the one it saved. */
  before: Practice | undefined
  after: Practice
  at: number
  /** What a smart cube saw of it, when one timed it. */
  seen?: Solve
  /** A smart cube started the clock but a hand stopped it, so the time isn't a solve's, and isn't kept. */
  cut?: boolean
}

export interface Round {
  /** Counts up, one per round. */
  n: number
  deck: DeckId
  way: Way
  /** Every case in the round, in the order they first come up. */
  ids: string[]
  /** Still to come. The first is the one being set up now. */
  queue: string[]
  next: Prompt | null
  done: Attempt[]
  start: number
  /** Over, and whether every case was done. */
  over: boolean
  complete: boolean
}

export const round = signal<Round | null>(null)
let rounds = 0

function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function prompt(id: string, way: Way): Prompt {
  if (way === 'screen') return { id, moves: null, view: Math.floor(Math.random() * 4) as Turn }
  const s = scramble(caseById.get(id)!)
  return { id, moves: s.moves, view: s.view }
}

export function begin(deck: DeckId, ids: string[], way: Way) {
  if (!ids.length) return
  const order = shuffle(ids)
  round.set({ n: ++rounds, deck, way, ids: order, queue: order, next: prompt(order[0], way), done: [], start: Date.now(), over: false, complete: false })
}

/**
 * The case coming up was done in `cs` hundredths, timed by the keys or, with what it saw, a smart
 * cube. `cut` when a smart cube started the clock and a hand stopped it: the time isn't kept.
 */
export function finish(cs: number, seen?: Solve, cut = false): Attempt | null {
  const r = round.get()
  if (!r?.next || r.over) return null
  const { id, view } = r.next
  const before = practiceOf(id)
  const timed = r.way !== 'screen' && !cut
  const at = Date.now()
  const after = practised(before, true, timed ? cs : null, at, seen?.look)
  const was = seen ? before?.smart?.best : before?.best
  const attempt: Attempt = { id, view, cs, missed: false, best: timed && was !== undefined && cs < was, before, after, at, seen, cut }
  setPractice(id, after)
  const queue = r.queue.slice(1)
  round.set({ ...r, queue, next: queue.length ? prompt(queue[0], r.way) : null, done: [...r.done, attempt] })
  return attempt
}

/** Mark the last one as missed, or take that back. A missed case comes round again soon. */
export function toggleMiss(): boolean | null {
  const r = round.get()
  const last = r?.done[r.done.length - 1]
  if (!r || !last || r.over) return null
  const missed = !last.missed
  // only rewrite the record this attempt saved, not one that a cleared or imported progress put there since
  let { after } = last
  if (practiceOf(last.id) === after) {
    after = practised(last.before, !missed, !missed && r.way !== 'screen' && !last.cut ? last.cs : null, last.at, last.seen?.look)
    setPractice(last.id, after)
  }
  let { queue, next } = r
  if (missed) {
    // after two to four others, and never ahead of the case that may already be on the cube
    const at = Math.min(queue.length, 2 + Math.floor(Math.random() * 3))
    queue = [...queue.slice(0, at), last.id, ...queue.slice(at)]
  } else {
    const at = queue.lastIndexOf(last.id)
    if (at >= 0) queue = queue.filter((_, i) => i !== at)
  }
  if (!queue.length) next = null
  else if (next?.id !== queue[0]) next = prompt(queue[0], r.way)
  round.set({ ...r, queue, next, done: [...r.done.slice(0, -1), { ...last, missed, after }] })
  return missed
}

/** Stop here and see how it went. With nothing done, there's nothing to see. */
export function end() {
  const r = round.get()
  if (!r) return
  if (!r.done.length) round.set(null)
  else round.set({ ...r, over: true, complete: !r.queue.length, next: null })
}

/** Pick up a round that was ended early, with a fresh scramble. */
export function resume() {
  const r = round.get()
  if (!r?.over || !r.queue.length) return
  round.set({ ...r, over: false, next: prompt(r.queue[0], r.way) })
}

export const leave = () => round.set(null)
