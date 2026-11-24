import { useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { caseById, setById, subById, type Case, type Subset, type ZSet } from '../data/index.ts'

export type Route =
  | { page: 'home' }
  | { page: 'set'; set: ZSet }
  | { page: 'sub'; set: ZSet; sub: Subset }
  | { page: 'case'; set: ZSet; sub: Subset; case: Case }

/** Plain hashes: #T is a set, #T3 a subset, #T3-5 a case. */
function read(hash: string): Route {
  const id = decodeURIComponent(hash.replace(/^#/, ''))
  const c = caseById.get(id)
  if (c) return { page: 'case', set: setById.get(c.set)!, sub: subById.get(c.sub)!, case: c }
  const sub = subById.get(id)
  if (sub) return { page: 'sub', set: setById.get(sub.set)!, sub }
  const set = setById.get(id)
  if (set) return { page: 'set', set }
  return { page: 'home' }
}

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

/** Swap pages. When one of them is a case, its picture glides between the two. */
function show(next: Route, top: number) {
  const from = route
  const shared = next.page === 'case' && from.page !== 'case' ? next.case.id : from.page === 'case' && next.page !== 'case' ? from.case.id : null
  const update = () => {
    route = next
    listeners.forEach((l) => l())
  }
  const swap = () => {
    flushSync(update)
    scrollTo({ top, behavior: 'instant' })
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
  t.finished
    .catch(() => {})
    .finally(() => {
      const after = shared && diagram(shared)
      if (after) after.style.viewTransitionName = ''
    })
}

export const href = (id: string) => `#${id}`

/** Go to a set, subset or case by id. An empty id is home. */
export function go(id: string) {
  const hash = id ? `#${id}` : location.pathname + location.search
  if ((location.hash || '') === (id ? `#${id}` : '')) {
    scrollTo({ top: 0, behavior: calm.matches ? 'instant' : 'smooth' })
    return
  }
  scrolls.set(depth, scrollY)
  depth++
  history.pushState({ depth }, '', hash)
  show(read(location.hash), 0)
}

history.scrollRestoration = 'manual'
addEventListener('popstate', (e) => {
  scrolls.set(depth, scrollY)
  const to = (e.state as { depth?: number } | null)?.depth ?? 0
  depth = to
  show(read(location.hash), scrolls.get(to) ?? 0)
})

/** In-page links run through go() so every page change is handled the same way. */
addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const a = (e.target as Element).closest?.('a[href^="#"]')
  if (!a) return
  e.preventDefault()
  go(a.getAttribute('href')!.slice(1))
})
