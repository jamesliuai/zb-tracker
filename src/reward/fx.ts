/** One canvas over the page for everything that leaves its box: rings, crumbs and stickers in flight. */

type Draw = (c: CanvasRenderingContext2D, p: number) => void
interface Effect {
  from: number
  length: number
  draw: Draw
  end?: () => void
}

let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let effects: Effect[] = []
let frame = 0

export const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches

function setup() {
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.className = 'fx'
    canvas.setAttribute('aria-hidden', 'true')
    document.body.append(canvas)
    ctx = canvas.getContext('2d')
  }
  const scale = Math.min(2, devicePixelRatio || 1)
  const w = Math.round(innerWidth * scale)
  const h = Math.round(innerHeight * scale)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  ctx!.setTransform(scale, 0, 0, scale, 0, 0)
}

function loop(now: number) {
  ctx!.clearRect(0, 0, innerWidth, innerHeight)
  const finished: Effect[] = []
  effects = effects.filter((e) => {
    const p = (now - e.from) / e.length
    if (p < 0) return true
    if (p >= 1) {
      finished.push(e)
      return false
    }
    ctx!.save()
    e.draw(ctx!, p)
    ctx!.restore()
    return true
  })
  frame = effects.length ? requestAnimationFrame(loop) : 0
  if (!frame) ctx!.clearRect(0, 0, innerWidth, innerHeight)
  finished.forEach((e) => e.end?.())
}

function add(length: number, draw: Draw, delay = 0, end?: () => void) {
  setup()
  effects.push({ from: performance.now() + delay, length, draw, end })
  if (!frame) frame = requestAnimationFrame(loop)
}

const out = (p: number) => 1 - (1 - p) ** 3
const outer = (p: number) => 1 - (1 - p) ** 5

function square(c: CanvasRenderingContext2D, x: number, y: number, size: number, turn = 0) {
  c.translate(x, y)
  c.rotate(turn)
  c.beginPath()
  c.roundRect(-size / 2, -size / 2, size, size, size * 0.24)
  c.fill()
}

/** A breath of color behind everything on the page. */
export function wash(x: number, y: number, color: string, strength = 0.34) {
  const reach = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  const el = document.createElement('div')
  el.className = 'wash'
  el.setAttribute('aria-hidden', 'true')
  Object.assign(el.style, { left: `${x - reach}px`, top: `${y - reach}px`, width: `${reach * 2}px`, height: `${reach * 2}px`, color })
  document.body.append(el)
  el.animate(
    [
      { opacity: 0, scale: 0.25 },
      { opacity: strength, scale: 0.62, offset: 0.16 },
      { opacity: 0, scale: 1 },
    ],
    { duration: 1500, easing: 'cubic-bezier(.25, .7, .3, 1)' },
  ).finished.catch(() => {}).finally(() => el.remove())
}

/** A sticker-shaped ripple. */
export function ring(b: DOMRect, color: string, o: { reach?: number; width?: number; delay?: number; radius?: number } = {}) {
  const { reach = 54, width = 3, delay = 0, radius = 0.16 } = o
  add(
    820,
    (c, p) => {
      const d = reach * outer(p)
      c.globalAlpha = (1 - p) ** 1.5
      c.lineWidth = width * (1 - p) + 0.2
      c.strokeStyle = color
      c.beginPath()
      c.roundRect(b.x - d, b.y - d, b.width + d * 2, b.height + d * 2, b.width * radius + d * 0.8)
      c.stroke()
    },
    delay,
  )
}

/** The solved sides throw off their colors: three stickers each way, plus the corners. */
export function bloom(b: DOMRect, sides: [string, string, string, string], corner: string) {
  const size = Math.max(5, Math.min(15, b.width * 0.05))
  const reach = Math.max(34, Math.min(120, b.width * 0.42))
  const bits: { x: number; y: number; dx: number; dy: number; color: string; spin: number; size: number; wait: number }[] = []
  const dirs = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]
  dirs.forEach(([dx, dy], s) => {
    for (let i = -1; i <= 1; i++) {
      const along = (i * b.width) / 3.6
      bits.push({
        x: b.x + b.width / 2 + dx * b.width * 0.48 + (dy ? along : 0),
        y: b.y + b.height / 2 + dy * b.height * 0.48 + (dx ? along : 0),
        dx: dx + (dy ? i * 0.34 : 0),
        dy: dy + (dx ? i * 0.34 : 0),
        color: sides[s],
        spin: (i || 0.5) * (s % 2 ? -1 : 1) * 1.5,
        size: size * (i ? 0.85 : 1.1),
        wait: Math.abs(i) * 0.05,
      })
    }
  })
  for (const [sx, sy] of [[1, -1], [1, 1], [-1, 1], [-1, -1]])
    bits.push({ x: b.x + b.width / 2 + sx * b.width * 0.45, y: b.y + b.height / 2 + sy * b.height * 0.45, dx: sx * 0.82, dy: sy * 0.82, color: corner, spin: sx * 2, size: size * 0.7, wait: 0.08 })

  add(900, (c, p) => {
    for (const k of bits) {
      const q = Math.min(1, Math.max(0, (p - k.wait) / (1 - k.wait)))
      if (!q) continue
      const d = reach * outer(q)
      c.save()
      c.globalAlpha = q < 0.55 ? 1 : 1 - (q - 0.55) / 0.45
      c.fillStyle = k.color
      square(c, k.x + k.dx * d, k.y + k.dy * d, k.size * (1 - 0.75 * q ** 1.4), k.spin * out(q))
      c.restore()
    }
  })
}

/** A single sticker travels from one place to another. */
export function fly(from: { x: number; y: number; size: number }, to: { x: number; y: number; size: number }, color: string, land: () => void, delay = 0) {
  const lift = Math.min(180, Math.hypot(to.x - from.x, to.y - from.y) * 0.28)
  const cx = from.x + (to.x - from.x) * 0.25
  const cy = Math.min(from.y, to.y) + (Math.max(from.y, to.y) - Math.min(from.y, to.y)) * 0.35 - lift
  const trail: [number, number, number][] = []
  add(
    620,
    (c, p) => {
      const t = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
      const x = (1 - t) ** 2 * from.x + 2 * (1 - t) * t * cx + t * t * to.x
      const y = (1 - t) ** 2 * from.y + 2 * (1 - t) * t * cy + t * t * to.y
      const size = (from.size + (to.size - from.size) * t) * Math.min(1, p * 8)
      trail.push([x, y, size])
      if (trail.length > 9) trail.shift()
      c.fillStyle = color
      trail.forEach(([tx, ty, ts], i) => {
        const k = (i + 1) / trail.length
        c.save()
        c.globalAlpha = k === 1 ? 1 : k * 0.22
        square(c, tx, ty, ts * (0.55 + 0.45 * k), t * Math.PI)
        c.restore()
      })
    },
    delay,
    land,
  )
}

/** A few crumbs where something lands. */
export function spark(x: number, y: number, color: string, n = 8, reach = 26) {
  add(520, (c, p) => {
    c.fillStyle = color
    c.globalAlpha = 1 - p ** 2
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      c.save()
      square(c, x + Math.cos(a) * reach * outer(p), y + Math.sin(a) * reach * outer(p), 4.5 * (1 - p), a)
      c.restore()
    }
  })
}
