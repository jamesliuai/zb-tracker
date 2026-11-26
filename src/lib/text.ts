import type { Subset } from '../data/index.ts'
import { setById } from '../data/index.ts'

/** The sheet writes "Same/Opposite". A little air makes it readable, and the slash stays with the first word. */
export const airy = (name: string) => name.replace(/\s*\/\s*/g, '\u00a0/ ')

/** What a subset is called on its own: T3, Edges, or ZBLS 5 for one that only has a number. */
export const subName = (sub: Subset) => (sub.name ? sub.short : `${sub.deck} ${sub.short}`)

/** The words that go with a subset: its name, or its set's when it only has a number. */
export const subWords = (sub: Subset) => airy(sub.name || setById.get(sub.set)!.name)

/** A subset's number or short name and its name, as far as it has one. */
export const subLine = (sub: Subset) => [sub.short, airy(sub.name)].filter(Boolean).join(' ')

export const date = (t: number) => {
  const d = new Date(t)
  const same = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, same ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Hundredths of a second the way a timer shows them: 3.42, or 1:02.50 past a minute. */
export function clock(cs: number) {
  const t = Math.max(0, Math.round(cs))
  const s = Math.floor(t / 100)
  const tail = `.${String(t % 100).padStart(2, '0')}`
  return s < 60 ? `${s}${tail}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}${tail}`
}

/** A time to come, roughly: later today, tomorrow, in 4 days, in 3 weeks. */
export function when(t: number) {
  const days = Math.round((new Date(t).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
  if (days <= 0) return 'later today'
  if (days === 1) return 'tomorrow'
  if (days < 14) return `in ${days} days`
  if (days < 60) return `in ${Math.round(days / 7)} weeks`
  return `in ${Math.round(days / 30)} months`
}

/** Spread onto an element to give it the shade of a subset. */
export function shade(sub: Subset) {
  const last = setById.get(sub.set)!.subs.length - 1
  return { 'data-set': sub.set, 'data-m': '', style: { '--m': `${last && Math.round(((sub.n - 1) / last) * 100)}%` } as React.CSSProperties }
}
