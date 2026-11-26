import { useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { caseById, deckById, setById, subById, type Case, type Deck, type DeckId, type Subset, type ZSet } from '../data/index.ts'
import { getData } from '../state/store.ts'

export type Route =
  | { page: 'home'; deck: Deck; part?: ZSet }
  | { page: 'set'; deck: Deck; set: ZSet }
  | { page: 'sub'; deck: Deck; set: ZSet; sub: Subset }
  | { page: 'case'; deck: Deck; set: ZSet; sub: Subset; case: Case }
  | { page: 'train'; deck: Deck }

/** The plain address is ZBLL. Another deck has its own name. */
export const homeOf = (deck: DeckId) => (deck === 'ZBLL' ? '' : deck)
export const trainOf = (deck: DeckId) => (deck === 'ZBLL' ? 'train' : `${deck}-train`)

/**
 * Plain hashes: #T is a set, #T3 a subset, #T3-5 a case, and #PLL the other deck, with #PLL-Ja a
 * case in it and #PLL-edges a part of its one page. #train and #PLL-train are the trainers.
 */
function read(hash: string): Route {
  const id = decodeURIComponent(hash.replace(/^#/, ''))
  const train = /^(?:(\w+)-)?train$/i.exec(id)
  const trains = train && deckById.get((train[1]?.toUpperCase() ?? 'ZBLL') as DeckId)
  if (trains) return { page: 'train', deck: trains }
  const c = caseById.get(id)
  const sub = c ? subById.get(c.sub) : subById.get(id)
  const set = sub ? setById.get(sub.set) : setById.get(id)
  const deck = deckById.get(set?.deck ?? (id.toUpperCase() as DeckId)) ?? deckById.get('ZBLL')!
  if (!set) return { page: 'home', deck }
  if (c) return { page: 'case', deck, set, sub: sub!, case: c }
  if (deck.flat) return { page: 'home', deck, part: set }
  return sub ? { page: 'sub', deck, set, sub } : { page: 'set', deck, set }
}

/** A fresh visit to the plain address picks up in the deck that was open last. */
function start() {
  const { deck } = getData().prefs
  const [visit] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
  if (!location.hash && homeOf(deck) && visit?.type === 'navigate') history.replaceState(history.state, '', `#${homeOf(deck)}`)
}
start()

let route = read(location.hash)
let depth = (history.state as { depth?: number } | null)?.depth ?? 0
const scrolls = new Map<number, number>()
const listeners = new Set<() => void>()
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useRoute = () => useSyncExternalStore(subscribe, () => route)
export const getRoute = () => route

const calm = matchMedia('(prefers-reduced-motion: reduce)')
const diagram = (id: string) => document.querySelector<SVGElement>(`:is(main, main *)[data-case="${id}"] .cube`)

/** How far down the page a route starts. Only a part of a page is anywhere but the top. */
function topOf(r: Route) {
  const part = r.page === 'home' && r.part && document.getElementById(r.part.id)
  if (!part) return 0
  return part.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(part).scrollMarginTop)
}

/** Once the first page is drawn, start it in the right place. */
export function settle() {
  scrollTo({ top: topOf(route), behavior: 'instant' })
}

/** Swap pages. When one of them is a case, its picture glides between the two. */
function show(next: Route, top?: number) {
  const from = route
  const shared = next.page === 'case' && from.page !== 'case' ? next.case.id : from.page === 'case' && next.page !== 'case' ? from.case.id : null
  const update = () => {
    route = next
    listeners.forEach((l) => l())
  }
  if (from.page === 'home' && next.page === 'home' && from.deck === next.deck) {
    flushSync(update)
    scrollTo({ top: top ?? topOf(next), behavior: calm.matches ? 'instant' : 'smooth' })
    return
  }
  const swap = () => {
    flushSync(update)
    scrollTo({ top: top ?? topOf(next), behavior: 'instant' })
  }
  if (!document.startViewTransition || calm.matches || document.hidden) return swap()

  const sameKind = next.page === 'case' && from.page === 'case'
  document.documentElement.dataset.nav = sameKind ? 'step' : 'page'
  const before = shared && diagram(shared)
  if (before) before.style.viewTransitionName = 'cube'
  const t = document.startViewTransition(() => {
    swap()
    if (before) before.style.viewTransitionName = ''
    const after = shared && diagram(shared)
    if (after) after.style.viewTransitionName = 'cube'
  })
  t.ready.catch(() => {}) // skipped for a newer one, and that's fine
  t.finished
    .catch(() => {})
    .finally(() => {
      const after = shared && diagram(shared)
      if (after) after.style.viewTransitionName = ''
    })
}

/** Go to a deck, set, subset or case by id. An empty id is the first deck. */
export function go(id: string) {
  const hash = id ? `#${id}` : location.pathname + location.search
  if ((location.hash || '') === (id ? `#${id}` : '')) {
    scrollTo({ top: topOf(route), behavior: calm.matches ? 'instant' : 'smooth' })
    return
  }
  scrolls.set(depth, scrollY)
  depth++
  history.pushState({ depth }, '', hash)
  show(read(location.hash))
}

history.scrollRestoration = 'manual'
addEventListener('popstate', (e) => {
  scrolls.set(depth, scrollY)
  const to = (e.state as { depth?: number } | null)?.depth ?? 0
  depth = to
  show(read(location.hash), scrolls.get(to))
})

/** In-page links run through go() so every page change is handled the same way. */
addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const a = (e.target as Element).closest?.('a[href^="#"]')
  if (!a) return
  e.preventDefault()
  go(a.getAttribute('href')!.slice(1))
})
