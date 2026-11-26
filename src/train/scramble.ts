/**
 * Scrambles that put a case on a solved cube without giving it away.
 *
 * Undoing one of the case's own algorithms is the obvious scramble, but you would soon know the
 * case from the scramble instead of from the cube. So a scramble here undoes an algorithm for some
 * other case, turns the top, then undoes an algorithm for whatever case that leaves. Out of a few
 * dozen tries one of the shortest wins, about twenty turns, never one of the case's own algorithms
 * backwards, and never one of the last six scrambles for the case. Each one is checked on the
 * simulator before it's used.
 *
 * A ZBLS case is set up the same way round, in about a dozen turns: an algorithm for another ZBLS
 * case undone at the end, and in front of it, whichever ZBLS case that algorithm turns this one into.
 */
import { caseKey, isSlot, layerAfter, plain, slotAfter, tidy, turnU, undo, viewOf, type Turn } from '../cube/engine.ts'
import { caseByKey, cases, deckById, type Case } from '../data/index.ts'

let table: Map<string, string[][]> | null = null

/** Every way the sheets give of setting up each case, in face turns, shortest first. */
function setups() {
  if (table) return table
  table = new Map()
  for (const c of cases) {
    const ways = new Map<string, string[]>()
    for (const hand of ['two', 'oh'] as const)
      for (const a of [...c.algs[hand].main, ...c.algs[hand].more]) {
        const s = undo(plain(a.text))
        ways.set(s.join(' '), s)
      }
    table.set(c.id, [...ways.values()].sort((a, b) => a.length - b.length))
  }
  return table
}

const U = (n: number) => {
  const k = ((n % 4) + 4) % 4
  return k ? ['U' + ['', '', '2', "'"][k]] : []
}

/** Moves without the turns of the top at either end, which don't change what you'd recognize. */
const core = (moves: string[]) => moves.slice(moves[0]?.[0] === 'U' ? 1 : 0, moves.at(-1)?.[0] === 'U' ? -1 : undefined).join(' ')

/** The latest scrambles for each case, which it won't get again for a while. */
const recent = new Map<string, string[]>()
const MEMORY = 6

export interface Scramble {
  moves: string
  /** Quarter turns from the case's picture to how it sits on the cube afterwards. */
  view: Turn
}

/** What a scramble leaves on the cube, drawn the way the case is. */
const after = (c: Case, moves: string[]) => (isSlot(c.ll) ? slotAfter : layerAfter)(moves.join(' '))

/** Ways there for a last layer case: two algorithms undone, with a turn of the top between. */
function lastLayer(c: Case, target: string[], random: () => number): string[][] {
  const all = setups()
  // a PLL from two more PLLs stays short, while a ZBLL can start from any last layer
  const from = c.deck === 'PLL' ? deckById.get('PLL')!.cases : cases.filter((x) => !isSlot(x.ll))
  const key = caseKey(c.ll)
  const found: string[][] = []
  for (let i = 0; i < 80; i++) {
    const other = from[Math.floor(random() * from.length)]
    if (other === c) continue
    const ways = all.get(other.id)!
    const first = ways[Math.floor(random() * ways.length)]
    const m = Math.floor(random() * 4)
    // what's left to do after the first half, to end up at the case
    const rest = layerAfter([...U(-m), ...undo(first), ...target].join(' '))
    const then = rest && caseByKey.get(caseKey(rest))
    if (!then || then === c) continue
    const second = all.get(then.id)![0]
    for (let j = 0; j < 4; j++) {
      const s = tidy([...first, ...U(m + j), ...second])
      const ll = layerAfter(s.join(' '))
      if (ll && caseKey(ll) === key) {
        found.push(s)
        break
      }
    }
  }
  return found
}

/**
 * Ways there for a ZBLS case. Undoing another case's algorithm last means starting from what that
 * algorithm makes of this case, which is a ZBLS case too, set up first.
 */
function lastSlot(c: Case, target: string[], random: () => number): string[][] {
  const all = setups()
  const from = deckById.get('ZBLS')!.cases
  const key = caseKey(c.ll)
  const found: string[][] = []
  for (let i = 0; i < 80; i++) {
    const other = from[Math.floor(random() * from.length)]
    if (other === c) continue
    const ways = all.get(other.id)!
    const second = ways[Math.floor(random() * ways.length)]
    const before = slotAfter([...target, ...U(Math.floor(random() * 4)), ...undo(second)].join(' '))
    const then = before && caseByKey.get(caseKey(before))
    if (!then || then === c) continue
    const first = all.get(then.id)![0]
    const there = slotAfter(first.join(' '))!
    const k = [0, 1, 2, 3].find((n) => turnU(there, n) === before)
    if (k === undefined) continue
    const s = tidy([...first, ...U(k), ...second])
    const ll = slotAfter(s.join(' '))
    if (ll && caseKey(ll) === key) found.push(s)
  }
  return found
}

export function scramble(c: Case, random = Math.random): Scramble {
  const all = setups()
  const target = all.get(c.id)![0]
  // a 2GLL is often one short algorithm after another, so the shortest way there can be one of its own, backwards
  const avoid = new Set([...all.get(c.id)!.map(core), ...(recent.get(c.id) ?? [])])
  const found = (isSlot(c.ll) ? lastSlot : lastLayer)(c, target, random).filter((s) => !avoid.has(core(s)))
  const shortest = Math.min(...found.map((s) => s.length))
  const near = found.filter((s) => s.length <= shortest + 2)
  const pick = near.length ? near[Math.floor(random() * near.length)] : target
  recent.set(c.id, [...(recent.get(c.id) ?? []), core(pick)].slice(-MEMORY))
  const moves = tidy([...pick, ...U(Math.floor(random() * 4))])
  return { moves: moves.join(' '), view: viewOf(c.ll, after(c, moves)!)! }
}
