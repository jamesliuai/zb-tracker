/**
 * The smart cube: connecting to it, and what it says. The rest of the app sees a cube, its turns,
 * and whether it's there, and never the Bluetooth library.
 */
import type { SmartCubeConnection, SmartCubeEvent } from 'smartcube-web-bluetooth'
import { fromFacelets, solvedCube, turned, yellowUp, type Cube } from '../cube/engine.ts'
import { signal } from '../reward/signals.ts'
import { getData, setPrefs } from '../state/store.ts'
import type { Turn } from './solve.ts'

/** Web Bluetooth is only in Chrome and Edge, and only on a secure page. */
export const bluetooth = typeof navigator !== 'undefined' && 'bluetooth' in navigator && globalThis.isSecureContext === true
/** While developing, a virtual cube stands in where there's no Bluetooth. */
export const canConnect = bluetooth || import.meta.env.DEV

export interface Link {
  state: 'off' | 'connecting' | 'on'
  name?: string
  battery?: number
  /** While connecting, what's happening. After it didn't work, why. */
  note?: string
}
export const link = signal<Link>({ state: 'off' })

/** The cube as it is now, yellow on top. */
export const live = signal<Cube>(solvedCube)

/** The cube needs its MAC address to connect, and it's being asked for. */
export const asking = signal<{ name: string; answer: (mac: string | null) => void } | null>(null)

/**
 * The Bluetooth library, fetched the first time it's wanted, so nobody without a smart cube
 * downloads it. The build makes it a file of its own beside the page (see vite.config.ts).
 */
type Library = typeof import('smartcube-web-bluetooth')
let library: Promise<Library> | null = null
const load = (): Promise<Library> =>
  (library ??=(import.meta.env.DEV ? import('smartcube-web-bluetooth') : import(/* @vite-ignore */ new URL('smartcube.js', document.baseURI).href)).catch((e: unknown) => {
    library = null
    throw e
  }))

/** Start fetching it before Connect is pressed, so the browser's list of cubes opens at once. */
export const warm = () => {
  if (bluetooth) load().catch(() => {})
}

/** A turn, or null when the cube was set some other way, with the cube after it and before. */
type Listener = (t: Turn | null, cube: Cube, before: Cube) => void
const listeners = new Set<Listener>()
export function onTurn(l: Listener) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

function put(cube: Cube, t: Turn | null) {
  const before = live.get()
  live.set(cube)
  listeners.forEach((l) => l(t, cube, before))
}

const turn = (t: Turn) => put(turned(live.get(), t.move), t)

let conn: SmartCubeConnection | null = null
let stop: (() => void) | null = null
/** The next report of the stickers is one that was asked for. Others can lag behind the turns. */
let asked = false

function hear(e: SmartCubeEvent) {
  if (e.type === 'MOVE') turn({ move: yellowUp(e.move), at: e.timestamp, host: e.localTimestamp, cube: e.cubeTimestamp })
  else if (e.type === 'FACELETS' && asked) {
    asked = false
    const cube = fromFacelets(e.facelets)
    if (cube) put(cube, null)
    else void drop('That’s not a 3×3, and the trainer needs one.')
  } else if (e.type === 'BATTERY') link.set({ ...link.get(), battery: Math.round(e.batteryLevel) })
  else if (e.type === 'DISCONNECT') void drop('The cube disconnected.')
}

/** What the library says while connecting, in this app's words. */
const said: Record<string, string> = {
  'Select your cube…': 'Pick your cube',
  'Reading advertisements…': 'Looking for its address',
  'Connecting…': 'Connecting',
  'Verifying connection…': 'Checking it works',
}

function why(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e)
  if (e instanceof DOMException && e.name === 'NotFoundError') return ''
  // the browser only shows its list of cubes right after a click, and loading took too long
  if (e instanceof DOMException && e.name === 'SecurityError') return 'The browser didn’t open its list of cubes. Try Connect again.'
  if (/MAC address, connection/.test(text)) return 'It needs your cube’s MAC address to connect.'
  if (/Timed out waiting for cube data/.test(text)) return 'The cube didn’t answer. Check its MAC address and try again.'
  if (/doesn't match any registered/.test(text)) return 'That isn’t a smart cube the trainer knows.'
  return 'It didn’t connect. Wake the cube with a turn, and try again.'
}

function ask(name: string) {
  return new Promise<string | null>((answer) =>
    asking.set({
      name,
      answer: (mac) => {
        asking.set(null)
        answer(mac)
      },
    }),
  )
}

/** A cube is there: what it says comes in from now on, and it stands in for the space bar. */
function attach(name: string, battery?: number) {
  link.set({ state: 'on', name, battery })
  if (getData().prefs.way === 'cube') setPrefs({ way: 'smart' })
}

/** Connect a smart cube. Only from a click or a key, as the browser wants. */
export async function connect() {
  if (link.get().state !== 'off') return
  if (!bluetooth) return virtual.connect()
  link.set({ state: 'connecting', note: said['Select your cube…'] })
  const lib = await load().catch(() => null)
  if (!lib) return link.set({ state: 'off', note: 'It couldn’t load what it needs to talk to the cube. Check you’re online, and try again.' })
  try {
    const c = await lib.connectSmartCube({
      // asked first, before it has tried by itself, and last, once it has
      macAddressProvider: (device, last) => (last ? ask(device.name || 'Your cube') : Promise.resolve(null)),
      onStatus: (note) => link.get().state === 'connecting' && link.set({ ...link.get(), note: said[note] ?? note.replace(/…$/, '') }),
    })
    conn = c
    const sub = c.events$.subscribe(hear)
    stop = () => sub.unsubscribe()
    live.set(solvedCube)
    attach(c.deviceName || 'Smart cube')
    if (c.capabilities.facelets) {
      asked = true
      c.sendCommand({ type: 'REQUEST_FACELETS' }).catch(() => {})
    }
    if (c.capabilities.battery) c.sendCommand({ type: 'REQUEST_BATTERY' }).catch(() => {})
  } catch (e) {
    conn = null
    link.set({ state: 'off', note: why(e) })
  }
}

async function drop(note?: string) {
  const c = conn
  stop?.()
  stop = null
  conn = null
  asked = false
  link.set({ state: 'off', note })
  await c?.disconnect().catch(() => {})
}

export const disconnect = () => drop()

/** The cube is solved, whatever it thought. For when it has lost track, say after turns it didn't catch. */
export function markSolved() {
  if (conn?.capabilities.reset) conn.sendCommand({ type: 'REQUEST_RESET' }).catch(() => {})
  put(solvedCube, null)
}

/**
 * A cube to try things with while developing, from the console: virtualCube.connect(), then
 * virtualCube.turn("R U R'"), with yellow on top and green in front. Half turns come as two
 * quarter turns, as from most cubes, and it keeps a clock of its own. With `wait` false the turns
 * come at once, with times as if `gap` apart, and pause(ms) leaves a gap in them.
 */
let clock = 0
const virtual = {
  connect() {
    if (!import.meta.env.DEV) return
    live.set(solvedCube)
    attach('Virtual cube', 100)
  },
  disconnect: () => drop('The cube disconnected.'),
  async turn(text: string, gap = 140, wait = true) {
    for (const m of text.split(/\s+/).filter(Boolean))
      for (const q of m.endsWith('2') ? [m[0], m[0]] : [m]) {
        clock = wait ? performance.now() : Math.max(performance.now(), clock + gap)
        turn({ move: q, at: clock, host: clock, cube: Math.round(clock * 1.004) })
        if (wait && gap) await new Promise((r) => setTimeout(r, gap))
      }
  },
  pause(ms: number) {
    clock = Math.max(performance.now(), clock) + ms
  },
  solved: markSolved,
}
if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { virtualCube: virtual })
