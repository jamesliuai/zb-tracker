/**
 * Scrambles that put a case on a solved cube without giving it away.
 *
 * Undoing one of the case's own algorithms is the obvious scramble, but you would soon know the
 * case from the scramble instead of from the cube. So a scramble here undoes an algorithm for some
 * other case, turns the top, then undoes an algorithm for whatever case that leaves. Out of a few
 * dozen tries one of the shortest wins, about twenty turns, never one of the case's own algorithms
 * backwards, and never one of the last six scrambles for the case. Each one is checked on the
 * simulator before it's used.
 */
import { caseKey, layerAfter, plain, tidy, undo, viewOf, type Turn } from '../cube/engine.ts'
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

export function scramble(c: Case, random = Math.random): Scramble {
  const all = setups()
  const key = caseKey(c.ll)
  const target = all.get(c.id)![0]
  // a 2GLL is often one short algorithm after another, so the shortest way there can be one of its own, backwards
  const avoid = new Set([...all.get(c.id)!.map(core), ...(recent.get(c.id) ?? [])])
  // a PLL from two more PLLs stays short, while a ZBLL can start from anything
  const from = c.deck === 'PLL' ? deckById.get('PLL')!.cases : cases
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
        if (!avoid.has(core(s))) found.push(s)
        break
      }
    }
  }
  const shortest = Math.min(...found.map((s) => s.length))
  const near = found.filter((s) => s.length <= shortest + 2)
  const pick = near.length ? near[Math.floor(random() * near.length)] : target
  recent.set(c.id, [...(recent.get(c.id) ?? []), core(pick)].slice(-MEMORY))
  const moves = tidy([...pick, ...U(Math.floor(random() * 4))]).join(' ')
  return { moves, view: viewOf(c.ll, layerAfter(moves)!)! }
}
