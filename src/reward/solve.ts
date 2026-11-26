/** Makes a drawn case solve itself: every sticker sweeps round to the place it belongs. */
import { homes, slots, SOLVED_SLOT, type Box } from '../cube/geometry.ts'

const running = new WeakMap<SVGElement, () => void>()
const ease = (p: number) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2)

interface Path {
  el: SVGRectElement
  a: Box
  b: Box
  r0: number
  r1: number
  t0: number
  dt: number
  delay: number
}

function paths(svg: SVGElement, ll: string): Path[] {
  const home = homes(ll)
  return [...svg.querySelectorAll<SVGRectElement>('rect[data-i]')].map((el) => {
    const i = Number(el.dataset.i)
    const a = slots[i]
    const b = slots[home[i]]
    const [ax, ay, bx, by] = [a.x + a.w / 2 - 50, a.y + a.h / 2 - 50, b.x + b.w / 2 - 50, b.y + b.h / 2 - 50]
    const t0 = Math.atan2(ay, ax)
    let dt = Math.atan2(by, bx) - t0
    while (dt > Math.PI) dt -= 2 * Math.PI
    while (dt <= -Math.PI) dt += 2 * Math.PI
    return { el, a, b, r0: Math.hypot(ax, ay), r1: Math.hypot(bx, by), t0, dt, delay: ((i * 7) % 21) / 21 }
  })
}

function place({ el, a, b, r0, r1, t0, dt, delay }: Path, p: number) {
  const stagger = 0.16
  const q = ease(Math.min(1, Math.max(0, (p - delay * stagger) / (1 - stagger))))
  const squeeze = 1 - 0.14 * Math.sin(Math.PI * q) * (a === b ? 0.6 : 1)
  const r = r0 + (r1 - r0) * q
  const t = t0 + dt * q
  const w = (a.w + (b.w - a.w) * q) * squeeze
  const h = (a.h + (b.h - a.h) * q) * squeeze
  el.setAttribute('x', String(50 + r * Math.cos(t) - w / 2))
  el.setAttribute('y', String(50 + r * Math.sin(t) - h / 2))
  el.setAttribute('width', String(w))
  el.setAttribute('height', String(h))
  el.setAttribute('rx', String(a.r + (b.r - a.r) * q))
}

interface Pace {
  there: number
  hold: number
  back: number
  solved?: () => void
}

/**
 * A ZBLS case solves where it is, as the cube is seen from the slot's side: one sticker after another,
 * from the top down, takes the color it has once the edges are flipped and the pair is in.
 */
function solveSlot(svg: SVGElement, o: Pace) {
  const list = [...svg.querySelectorAll<SVGRectElement>('rect[data-s]')]
    .map((el) => ({ el, was: el.getAttribute('class')!, to: `st-${SOLVED_SLOT[Number(el.dataset.s)]}` }))
    .filter((x) => x.was !== x.to)
  const timers: number[] = []
  const later = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms))
  // only a sticker still showing what it was given, in case the picture was drawn again meanwhile
  const flip = (el: SVGRectElement, from: string, to: string) => {
    if (el.getAttribute('class') !== from) return
    el.setAttribute('class', to)
    el.animate([{ scale: 1 }, { scale: 0.78 }, { scale: 1 }], { duration: 320, easing: 'cubic-bezier(.3, 1.4, .5, 1)' })
  }
  const stop = () => {
    timers.forEach(clearTimeout)
    running.delete(svg)
    list.forEach((x) => x.el.getAttribute('class') === x.to && x.el.setAttribute('class', x.was))
  }
  running.set(svg, stop)
  const at = (i: number) => (i / list.length) * 0.75
  list.forEach((x, i) => later(at(i) * o.there, () => flip(x.el, x.was, x.to)))
  later(o.there, () => o.solved?.())
  list.forEach((x, i) => later(o.there + o.hold + at(i) * o.back, () => flip(x.el, x.to, x.was)))
  later(o.there + o.hold + o.back, stop)
}

/** Solve over `there` ms, rest for `hold`, return over `back`. Calls `solved` at the snap. */
export function solveDiagram(svg: SVGElement, ll: string, o: Pace) {
  running.get(svg)?.()
  if (svg.classList.contains('cube--slot')) return solveSlot(svg, o)
  const list = paths(svg, ll)
  let frame = 0
  let told = false
  const start = performance.now()
  const stop = () => {
    cancelAnimationFrame(frame)
    running.delete(svg)
    list.forEach((p) => place(p, 0))
    svg.removeAttribute('data-moving')
  }
  running.set(svg, stop)
  svg.setAttribute('data-moving', '') // the arrows on it have nothing left to say
  const step = (now: number) => {
    const t = now - start
    if (t < o.there) list.forEach((p) => place(p, t / o.there))
    else if (t < o.there + o.hold) {
      list.forEach((p) => place(p, 1))
      if (!told) {
        told = true
        o.solved?.()
      }
    } else if (t < o.there + o.hold + o.back) {
      if (!told) {
        told = true
        o.solved?.()
      }
      list.forEach((p) => place(p, 1 - (t - o.there - o.hold) / o.back))
    } else return stop()
    frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
}
