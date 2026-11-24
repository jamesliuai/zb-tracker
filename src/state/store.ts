import { useSyncExternalStore } from 'react'
import { TOTAL, caseById, cases, sets, subsets, type Hand } from '../data/index.ts'
import type { Turn } from '../cube/engine.ts'

/** 0 not started, 1 learning, 2 learned */
export type Status = 0 | 1 | 2

/** One way of recognizing and solving a case. */
export interface Angle {
  /** U turns applied to the printed picture, so it shows what you see. */
  rot: Turn
  /** Chosen algorithm, or null for the sheet's first choice. */
  alg: string | null
  /** What you look for. */
  rec: string
  /** How the AUF goes. */
  auf: string
}

export interface Entry {
  s?: Status
  /** When it was learned. */
  at?: number
  angles?: Angle[]
  note?: string
  own?: string[]
}

export type Theme = 'system' | 'light' | 'dark'

export interface Prefs {
  theme: Theme
  sound: boolean
  hand: Hand
}

export interface Data {
  v: 1
  cases: Record<string, Entry>
  prefs: Prefs
  /** The last case that was opened or changed. */
  last?: string
}

const KEY = 'zbll-tracker'
const blank = (): Data => ({ v: 1, cases: {}, prefs: { theme: 'system', sound: true, hand: 'two' } })
const NONE: Entry = Object.freeze({})

/* ------------------------------------------------------------------ reading what was saved */

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const str = (x: unknown) => (typeof x === 'string' ? x.slice(0, 4000) : '')

function readAngle(x: unknown): Angle | null {
  if (!isObject(x)) return null
  const rot = [0, 1, 2, 3].includes(x.rot as number) ? (x.rot as Turn) : 0
  return { rot, alg: typeof x.alg === 'string' ? x.alg.slice(0, 400) : null, rec: str(x.rec), auf: str(x.auf) }
}

/** Accepts anything, keeps only what makes sense. */
export function readData(x: unknown): Data | null {
  if (!isObject(x) || !isObject(x.cases)) return null
  const out = blank()
  for (const [id, raw] of Object.entries(x.cases)) {
    if (!caseById.has(id) || !isObject(raw)) continue
    const e: Entry = {}
    if (raw.s === 1 || raw.s === 2) e.s = raw.s
    if (typeof raw.at === 'number' && Number.isFinite(raw.at)) e.at = raw.at
    if (Array.isArray(raw.angles)) {
      const angles = raw.angles.slice(0, 2).map(readAngle).filter((a) => a !== null)
      if (angles.length) e.angles = angles
    }
    if (typeof raw.note === 'string' && raw.note) e.note = str(raw.note)
    if (Array.isArray(raw.own)) {
      const own = raw.own.filter((a): a is string => typeof a === 'string').slice(0, 20)
      if (own.length) e.own = own
    }
    if (Object.keys(e).length) out.cases[id] = e
  }
  if (isObject(x.prefs)) {
    const p = x.prefs
    if (p.theme === 'light' || p.theme === 'dark') out.prefs.theme = p.theme
    if (p.sound === false) out.prefs.sound = false
    if (p.hand === 'oh') out.prefs.hand = 'oh'
  }
  if (typeof x.last === 'string' && caseById.has(x.last)) out.last = x.last
  return out
}

/** False when the browser refuses to store anything, for example in some private windows. */
export let canSave = true

function load(): Data {
  try {
    const text = localStorage.getItem(KEY)
    return (text && readData(JSON.parse(text))) || blank()
  } catch {
    return blank()
  }
}

let data = load()
const listeners = new Set<() => void>()
let timer = 0

function write() {
  clearTimeout(timer)
  timer = 0
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
    canSave = true
  } catch {
    canSave = false
  }
}

function commit(next: Data) {
  data = next
  if (!timer) timer = window.setTimeout(write, 120)
  listeners.forEach((l) => l())
}

if (typeof window !== 'undefined') {
  addEventListener('pagehide', () => timer && write())
  document.addEventListener('visibilitychange', () => document.hidden && timer && write())
  addEventListener('storage', (e) => {
    if (e.key !== KEY) return
    data = load()
    listeners.forEach((l) => l())
  })
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/* ------------------------------------------------------------------ reading */

export const getData = () => data
export const getEntry = (id: string): Entry => data.cases[id] ?? NONE
export const statusOf = (id: string): Status => getEntry(id).s ?? 0

export const useEntry = (id: string) => useSyncExternalStore(subscribe, () => getEntry(id))
export const useStatus = (id: string) => useSyncExternalStore(subscribe, () => statusOf(id))
export const usePrefs = () => useSyncExternalStore(subscribe, () => data.prefs)
export const useCases = () => useSyncExternalStore(subscribe, () => data.cases)
export const useLast = () => useSyncExternalStore(subscribe, () => data.last)

export interface Stats {
  learned: number
  learning: string[]
  bySet: Map<string, number>
  bySub: Map<string, number>
  today: number
  /** Learned in the last seven days. */
  week: number
  /** Learned per week over the last four weeks. */
  pace: number
}

let statsFor: Data['cases'] | null = null
let stats: Stats
export function getStats(): Stats {
  if (statsFor === data.cases) return stats
  statsFor = data.cases
  const bySet = new Map(sets.map((s) => [s.id, 0]))
  const bySub = new Map(subsets.map((s) => [s.id, 0]))
  const learning: string[] = []
  const now = Date.now()
  const day = 86_400_000
  const midnight = new Date().setHours(0, 0, 0, 0)
  let learned = 0
  let today = 0
  let week = 0
  let month = 0
  let first = now
  for (const c of cases) {
    const e = data.cases[c.id]
    if (!e?.s) continue
    if (e.s === 1) learning.push(c.id)
    else {
      learned++
      bySet.set(c.set, bySet.get(c.set)! + 1)
      bySub.set(c.sub, bySub.get(c.sub)! + 1)
      if (e.at) {
        if (e.at >= midnight) today++
        if (now - e.at < 7 * day) week++
        if (now - e.at < 28 * day) month++
        first = Math.min(first, e.at)
      }
    }
  }
  const weeks = Math.min(4, Math.max(1, (now - first) / (7 * day)))
  stats = { learned, learning, bySet, bySub, today, week, pace: month / weeks }
  return stats
}
export const useStats = () => useSyncExternalStore(subscribe, getStats)

/** The next case to learn: same subset first, then same set, then anything. */
export function nextUp(after?: string): string | null {
  const open = (id: string) => statusOf(id) !== 2
  const from = after ? caseById.get(after) : undefined
  if (from) {
    const sub = subsets.find((s) => s.id === from.sub)!.cases
    const set = sets.find((s) => s.id === from.set)!.cases
    const all = [...sub.slice(from.n), ...sub.slice(0, from.n), ...set, ...cases]
    return all.find((c) => c.id !== after && open(c.id))?.id ?? null
  }
  return cases.find((c) => open(c.id))?.id ?? null
}

export const isDone = (learned: number) => learned === TOTAL

/* ------------------------------------------------------------------ writing */

const clean = (e: Entry): Entry | undefined => {
  const out: Entry = { ...e }
  if (!out.s) delete out.s
  if (out.s !== 2) delete out.at
  if (!out.note) delete out.note
  if (!out.own?.length) delete out.own
  if (out.angles?.length === 1) {
    const [a] = out.angles
    if (!a.rot && !a.alg && !a.rec && !a.auf) delete out.angles
  }
  return Object.keys(out).length ? out : undefined
}

function patch(changes: Record<string, Entry>, last?: string) {
  const next = { ...data.cases }
  for (const [id, e] of Object.entries(changes)) {
    const c = clean(e)
    if (c) next[id] = c
    else delete next[id]
  }
  commit({ ...data, cases: next, last: last ?? data.last })
}

/** Set one status on many cases. Returns a function that puts things back. */
export function setStatus(ids: string[], s: Status): () => void {
  const before = Object.fromEntries(ids.map((id) => [id, getEntry(id)]))
  const now = Date.now()
  patch(Object.fromEntries(ids.map((id) => [id, { ...getEntry(id), s, at: s === 2 ? (getEntry(id).at ?? now) : undefined }])), ids[ids.length - 1])
  return () => patch(before)
}

export function updateEntry(id: string, change: Partial<Entry>) {
  patch({ [id]: { ...getEntry(id), ...change } }, id)
}

const blankAngle = (): Angle => ({ rot: 0, alg: null, rec: '', auf: '' })
export const anglesOf = (e: Entry): Angle[] => (e.angles?.length ? e.angles : [blankAngle()])

export function updateAngle(id: string, i: number, change: Partial<Angle>) {
  const angles = anglesOf(getEntry(id)).map((a, j) => (j === i ? { ...a, ...change } : a))
  updateEntry(id, { angles })
}

export function addAngle(id: string, angle: Partial<Angle>) {
  const angles = anglesOf(getEntry(id))
  if (angles.length < 2) updateEntry(id, { angles: [...angles, { ...blankAngle(), ...angle }] })
}

export function removeAngle(id: string, i: number): () => void {
  const before = getEntry(id)
  updateEntry(id, { angles: anglesOf(before).filter((_, j) => j !== i) })
  return () => patch({ [id]: before })
}

export function touch(id: string) {
  if (data.last !== id) commit({ ...data, last: id })
}

export function setPrefs(change: Partial<Prefs>) {
  commit({ ...data, prefs: { ...data.prefs, ...change } })
}

export function replaceData(next: Data): () => void {
  const before = data
  commit(next)
  return () => commit(before)
}

export const exportText = () => JSON.stringify(data, null, 1)
export const emptyData = (): Data => ({ ...blank(), prefs: data.prefs })
