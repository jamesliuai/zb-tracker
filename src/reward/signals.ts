/** Small pieces of shared state for things that are on screen for a moment. */
import { useSyncExternalStore } from 'react'

function signal<T>(value: T) {
  const listeners = new Set<() => void>()
  const subscribe = (l: () => void) => {
    listeners.add(l)
    return () => listeners.delete(l)
  }
  return {
    get: () => value,
    set(next: T) {
      value = next
      listeners.forEach((l) => l())
    },
    use: () => useSyncExternalStore(subscribe, () => value),
  }
}

/** Stickers on their way to the counter. It counts them when they land. */
export const inFlight = signal(0)

/** A subset whose cells should ripple. */
export const ripple = signal<string | null>(null)

/** A finished set, or 'all', being celebrated over the whole page. */
export const finale = signal<string | null>(null)

export interface Toast {
  key: number
  text: string
  /** The subset it's about, which gives it its color. */
  sub?: string
  /** Cells to light up in the toast, one per case. */
  cells?: number
  undo?: () => void
}
export const toast = signal<Toast | null>(null)

let key = 0
let timer = 0
export function say(t: Omit<Toast, 'key'>, ms = 4200) {
  clearTimeout(timer)
  const mine = ++key
  toast.set({ key: mine, ...t })
  timer = window.setTimeout(() => toast.get()?.key === mine && toast.set(null), ms)
}
