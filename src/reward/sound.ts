/**
 * Every sound is synthesized, nothing is loaded. The idea: a fast algorithm being turned
 * (soft plastic ticks), the last move snapping into place, then a bell. Each case you learn in a
 * subset rings one step higher, and the twelfth resolves into a chord.
 */
import { getData } from '../state/store.ts'

interface Rig {
  ctx: AudioContext
  dry: GainNode
  send: GainNode
  noise: AudioBuffer
}

let rig: Rig | null = null

function build(): Rig {
  const ctx = new AudioContext({ latencyHint: 'interactive' })
  const master = new GainNode(ctx, { gain: 1.3 })
  const glue = new DynamicsCompressorNode(ctx, { threshold: -16, ratio: 3, attack: 0.004, release: 0.18 })
  const air = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 9500, Q: 0.4 })
  master.connect(air).connect(glue).connect(ctx.destination)

  const rate = ctx.sampleRate
  // a small, soft room
  const length = Math.floor(rate * 1.7)
  const room = new AudioBuffer({ numberOfChannels: 2, length, sampleRate: rate })
  for (let ch = 0; ch < 2; ch++) {
    const d = room.getChannelData(ch)
    let low = 0
    for (let i = 0; i < length; i++) {
      const t = 1 - i / length
      low += ((Math.random() * 2 - 1) * t * t * t - low) * (0.15 + 0.5 * t) // loses treble as it fades
      d[i] = low
    }
  }
  const verb = new ConvolverNode(ctx, { buffer: room })
  const wet = new GainNode(ctx, { gain: 0.5 })
  const pre = new DelayNode(ctx, { delayTime: 0.012 })
  const send = new GainNode(ctx, { gain: 1 })
  send.connect(pre).connect(verb).connect(wet).connect(master)

  const noise = new AudioBuffer({ length: rate, sampleRate: rate })
  const n = noise.getChannelData(0)
  for (let i = 0; i < rate; i++) n[i] = Math.random() * 2 - 1

  return { ctx, dry: master, send, noise }
}

function ready(): Rig | null {
  if (!getData().prefs.sound || typeof AudioContext === 'undefined') return null
  try {
    rig ??= build()
    if (rig.ctx.state === 'suspended') void rig.ctx.resume()
    return rig
  } catch {
    return null
  }
}

/**
 * Opening the sound device can take a moment, so it happens on the first press of anything.
 * By the time that press becomes a click, the first reward can start without a hitch.
 */
if (typeof window !== 'undefined')
  for (const type of ['pointerdown', 'keydown']) addEventListener(type, () => void ready(), { once: true, capture: true, passive: true })

/* ------------------------------------------------------------------ instruments */

function fade(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
}

function tone(r: Rig, f: number, t: number, peak: number, decay: number, o: { attack?: number; type?: OscillatorType; room?: number; pan?: number; bend?: number } = {}) {
  const osc = new OscillatorNode(r.ctx, { type: o.type ?? 'sine', frequency: f })
  if (o.bend) osc.frequency.exponentialRampToValueAtTime(o.bend, t + decay)
  const g = new GainNode(r.ctx, { gain: 0 })
  fade(g, t, peak, o.attack ?? 0.004, decay)
  const pan = new StereoPannerNode(r.ctx, { pan: o.pan ?? 0 })
  osc.connect(g).connect(pan)
  pan.connect(r.dry)
  if (o.room) pan.connect(new GainNode(r.ctx, { gain: o.room })).connect(r.send)
  osc.start(t)
  osc.stop(t + (o.attack ?? 0.004) + decay + 0.05)
}

/** A clean struck bell: a pure note with quickly fading overtones. */
function bell(r: Rig, f: number, t: number, level = 1, pan = 0, long = 1) {
  tone(r, f, t, 0.2 * level, 1.15 * long, { room: 0.5, pan, attack: 0.005 })
  tone(r, f * 2, t, 0.062 * level, 0.6 * long, { room: 0.5, pan })
  tone(r, f * 3.01, t, 0.026 * level, 0.28 * long, { room: 0.4, pan })
  tone(r, f * 5.4, t, 0.014 * level, 0.09, { room: 0.2, pan })
}

function burst(r: Rig, t: number, peak: number, decay: number, filter: BiquadFilterOptions, room = 0.12, pan = 0) {
  const src = new AudioBufferSourceNode(r.ctx, { buffer: r.noise })
  const f = new BiquadFilterNode(r.ctx, filter)
  const g = new GainNode(r.ctx, { gain: 0 })
  fade(g, t, peak, 0.0012, decay)
  const p = new StereoPannerNode(r.ctx, { pan })
  src.connect(f).connect(g).connect(p)
  p.connect(r.dry)
  if (room) p.connect(new GainNode(r.ctx, { gain: room })).connect(r.send)
  src.start(t, Math.random() * 0.8, decay + 0.05)
}

/** One layer turning. */
function tick(r: Rig, t: number, level: number, pan = 0) {
  const f = 1500 + Math.random() * 900
  burst(r, t, 0.2 * level, 0.022, { type: 'bandpass', frequency: f, Q: 1.1 }, 0.1, pan)
  burst(r, t, 0.07 * level, 0.01, { type: 'highpass', frequency: 4200 }, 0.05, pan)
  tone(r, 240, t, 0.035 * level, 0.03, { bend: 150, pan })
}

/** The last layer snapping home. */
function snap(r: Rig, t: number, level = 1) {
  burst(r, t, 0.34 * level, 0.028, { type: 'bandpass', frequency: 1150, Q: 0.9 }, 0.22)
  burst(r, t, 0.12 * level, 0.012, { type: 'highpass', frequency: 3600 }, 0.12)
  tone(r, 190, t, 0.22 * level, 0.075, { bend: 88, attack: 0.002 })
}

/** A warm chord that swells under the bells. */
function pad(r: Rig, notes: number[], t: number, level: number, length: number) {
  for (const [i, f] of notes.entries()) {
    const osc = new OscillatorNode(r.ctx, { type: 'triangle', frequency: f, detune: i % 2 ? 4 : -4 })
    const lp = new BiquadFilterNode(r.ctx, { type: 'lowpass', frequency: 500, Q: 0.3 })
    lp.frequency.setValueAtTime(420, t)
    lp.frequency.linearRampToValueAtTime(1500, t + length * 0.3)
    lp.frequency.linearRampToValueAtTime(380, t + length)
    const g = new GainNode(r.ctx, { gain: 0 })
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(level, t + length * 0.22)
    g.gain.setTargetAtTime(0.0001, t + length * 0.45, length * 0.2)
    const p = new StereoPannerNode(r.ctx, { pan: (i / Math.max(1, notes.length - 1) - 0.5) * 0.7 })
    osc.connect(lp).connect(g).connect(p)
    p.connect(r.dry)
    p.connect(new GainNode(r.ctx, { gain: 0.7 })).connect(r.send)
    osc.start(t)
    osc.stop(t + length * 1.7)
  }
}

/* ------------------------------------------------------------------ tuning */

const ROOT = 311.13 // E flat
const note = (semitones: number) => ROOT * 2 ** (semitones / 12)
/** Twelve rising steps, one for each case in a subset. */
const ladder = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 24]
const rung = (step: number, of: number) => ladder[Math.min(11, Math.max(0, Math.round((step / of) * 12) - 1))]

/** Seconds from the press to the snap. The solving animation uses the same number. */
export const SNAP = { full: 0.43, quick: 0.27 }

/* ------------------------------------------------------------------ what the site plays */

/** A case was learned. `step` of `of` in its subset. */
export function playLearned(step: number, of: number, pace: 'full' | 'quick') {
  const r = ready()
  if (!r) return
  const t = r.ctx.currentTime + 0.01
  const at = SNAP[pace]
  const turns = pace === 'full' ? [0, 0.085, 0.16, 0.225, 0.28, 0.33, 0.375] : [0, 0.08, 0.145, 0.2]
  turns.forEach((d, i) => tick(r, t + d, 0.45 + 0.4 * (i / turns.length), i % 2 ? 0.18 : -0.18))
  snap(r, t + at)
  const n = rung(step, of)
  bell(r, note(n), t + at + 0.012, 0.95, -0.08)
  bell(r, note(n + 7), t + at + 0.092, 0.7, 0.12)
}

/** The sticker reaches the counter. */
export function playLand() {
  const r = ready()
  if (!r) return
  const t = r.ctx.currentTime
  tick(r, t, 0.9, 0.3)
  tone(r, note(36), t, 0.04, 0.3, { room: 0.5, pan: 0.3 })
}

/** One of many cases marked at once. */
export function playStep(i: number, of: number) {
  const r = ready()
  if (!r) return
  const t = r.ctx.currentTime
  tick(r, t, 0.7, (i / of) * 0.8 - 0.4)
  bell(r, note(rung(i + 1, of)), t, 0.62, (i / of) * 0.6 - 0.3, 0.6)
}

export function playSubset() {
  const r = ready()
  if (!r) return
  const t = r.ctx.currentTime + 0.02
  ;[0, 4, 7, 11, 14, 19, 24].forEach((n, i) => bell(r, note(n), t + i * 0.062, 0.62, (i - 3) * 0.13, 1.5))
  bell(r, note(28), t + 0.5, 0.4, 0.2, 1.8)
  pad(r, [note(-12), note(-5), note(2), note(4)], t, 0.045, 1.9)
}

export function playSet() {
  const r = ready()
  if (!r) return
  const t = r.ctx.currentTime + 0.02
  pad(r, [note(-7), note(0), note(4), note(9)], t, 0.05, 1.4)
  ;[5, 9, 12, 16, 21].forEach((n, i) => bell(r, note(n), t + i * 0.075, 0.5, -0.3 + i * 0.1, 1.2))
  pad(r, [note(-5), note(2), note(7), note(11)], t + 0.85, 0.05, 1.3)
  ;[7, 11, 14, 19, 23].forEach((n, i) => bell(r, note(n), t + 0.85 + i * 0.075, 0.5, 0.3 - i * 0.1, 1.2))
  pad(r, [note(-12), note(-5), note(4), note(7), note(14)], t + 1.75, 0.06, 3.2)
  ;[0, 4, 7, 12, 16, 19, 24, 28, 31].forEach((n, i) => bell(r, note(n), t + 1.75 + i * 0.07, 0.62, (i - 4) * 0.12, 2.1))
  snap(r, t + 1.75, 0.8)
}

/** Marked as learning. */
export function playLearning() {
  const r = ready()
  if (!r) return
  const t = r.ctx.currentTime
  tick(r, t, 1)
  bell(r, note(7), t + 0.02, 0.5, 0, 0.45)
}

/** A status was taken back. */
export function playUndo() {
  const r = ready()
  if (!r) return
  const t = r.ctx.currentTime
  tick(r, t, 0.9)
  tone(r, note(-5), t, 0.16, 0.24, { bend: note(-10), room: 0.25 })
}

/** The picture turned by a quarter. */
export function playTurn() {
  const r = ready()
  if (!r) return
  const t = r.ctx.currentTime
  tick(r, t, 0.55, -0.15)
  burst(r, t + 0.13, 0.15, 0.02, { type: 'bandpass', frequency: 1250, Q: 1 }, 0.1, 0.1)
  tone(r, 170, t + 0.13, 0.07, 0.05, { bend: 100 })
}
