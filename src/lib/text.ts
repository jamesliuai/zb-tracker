import type { Subset } from '../data/index.ts'
import { setById } from '../data/index.ts'

/** The sheet writes "Same/Opposite". A little air makes it readable, and the slash stays with the first word. */
export const airy = (name: string) => name.replace(/\s*\/\s*/g, '\u00a0/ ')

export const date = (t: number) => {
  const d = new Date(t)
  const same = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, same ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Spread onto an element to give it the shade of a subset. */
export function shade(sub: Subset) {
  const last = setById.get(sub.set)!.subs.length - 1
  return { 'data-set': sub.set, 'data-m': '', style: { '--m': `${last && Math.round(((sub.n - 1) / last) * 100)}%` } as React.CSSProperties }
}
