import { caseById, deckById, setById, subById, type Case } from '../data/index.ts'
import { SOLVED_LL } from '../cube/geometry.ts'
import { shade, subName } from '../lib/text.ts'
import { getStats, setStatus, statusOf, type Status } from '../state/store.ts'
import { bloom, calm, fly, ring, spark, wash } from './fx.ts'
import { finale, inFlight, ripple, say } from './signals.ts'
import { solveDiagram } from './solve.ts'
import { SNAP, playLand, playLearned, playLearning, playSet, playStep, playSubset, playUndo } from './sound.ts'

const css = (name: string, el: Element = document.documentElement) => getComputedStyle(el).getPropertyValue(name).trim()
const cubeColors = { U: '--cube-y', F: '--cube-b', R: '--cube-r', B: '--cube-g', L: '--cube-o' } as const
const center = (b: DOMRect) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 })
const onScreen = (b: DOMRect) => b.width > 0 && b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth
/** The color of a subset, as drawn. */
export const hueOf = (sub: string) => {
  const look = shade(subById.get(sub)!)
  const probe = document.createElement('i')
  probe.dataset.set = look['data-set']
  probe.dataset.m = ''
  probe.style.setProperty('--m', (look.style as Record<string, string>)['--m'])
  probe.style.color = 'var(--hue)'
  document.body.append(probe)
  const hue = getComputedStyle(probe).color
  probe.remove()
  return hue
}

const busy = new Set<string>()

/** The picture of a case that is on screen: the one beside what was pressed, or else the biggest. */
function picture(id: string, from?: Element): SVGSVGElement | null {
  const all = [...document.querySelectorAll<SVGSVGElement>(`:is(main, main *)[data-case="${id}"] .cube`)].filter((el) => onScreen(el.getBoundingClientRect()))
  const near = from?.closest('[data-case]')
  return all.find((el) => near?.contains(el)) ?? all.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0] ?? null
}

/** Mark a case as learned, with the full ceremony on its own page and a short one elsewhere. */
export function learn(id: string, pace: 'full' | 'quick' = 'full', from?: Element) {
  if (busy.has(id) || statusOf(id) === 2) return
  const c = caseById.get(id)!
  const sub = subById.get(c.sub)!
  const step = getStats(c.deck).bySub.get(c.sub)! + 1
  playLearned(step, sub.cases.length, pace)
  navigator.vibrate?.(pace === 'full' ? [8, 60, 8] : 10)

  const svg = picture(id, from)
  if (!svg || calm()) {
    setStatus([id], 2)
    milestones(c)
    return
  }

  busy.add(id)
  const hue = hueOf(c.sub)
  const ms = SNAP[pace] * 1000
  let done = false
  const solved = () => {
    if (done) return
    done = true
    busy.delete(id)
    const b = svg.isConnected ? svg.getBoundingClientRect() : null
    if (b && onScreen(b)) burst(svg, b, hue, pace)
    flight(b, hue)
    setStatus([id], 2)
    milestones(c, pace === 'full' ? 620 : 480)
  }
  svg.classList.add('is-solving')
  setTimeout(() => svg.classList.remove('is-solving'), ms + 500)
  solveDiagram(svg, c.ll, pace === 'full' ? { there: ms, hold: 820, back: 620, solved } : { there: ms, hold: 420, back: 420, solved })
  setTimeout(solved, ms + 400) // if the page was left or frames stopped, still count it
}

function burst(svg: SVGSVGElement, b: DOMRect, hue: string, pace: 'full' | 'quick') {
  // sides in screen order, so a rotated picture throws the right colors the right way
  const turn = Number(svg.dataset.rot ?? 0)
  const base = [SOLVED_LL[9], SOLVED_LL[12], SOLVED_LL[15], SOLVED_LL[18]] as (keyof typeof cubeColors)[]
  const sides = base.map((_, i) => css(cubeColors[base[(i - turn + 4) % 4]])) as [string, string, string, string]
  const { x, y } = center(b)
  svg.animate([{ scale: 1 }, { scale: pace === 'full' ? 1.07 : 1.14 }, { scale: 1 }], { duration: 460, easing: 'cubic-bezier(.3, 1.5, .5, 1)' })
  if (pace === 'full') {
    wash(x, y, hue)
    ring(b, hue, { reach: 70, width: 3.5 })
    ring(b, hue, { reach: 120, width: 2, delay: 90 })
    bloom(b, sides, css('--cube-y'))
  } else {
    ring(b, hue, { reach: 26, width: 2.4 })
    bloom(b, sides, css('--cube-y'))
  }
}

/** A sticker leaves for the counter in the header. */
function flight(b: DOMRect | null, hue: string) {
  const target = [...document.querySelectorAll('[data-counter]')].find((el) => onScreen(el.getBoundingClientRect()))
  if (!b || !onScreen(b) || !target) return
  const to = target.getBoundingClientRect()
  const from = center(b)
  const size = Math.max(12, b.width * 0.1)
  inFlight.set(inFlight.get() + 1)
  let landed = false
  const land = () => {
    if (landed) return
    landed = true
    inFlight.set(Math.max(0, inFlight.get() - 1))
    if (!target.isConnected) return
    const { x, y } = center(target.getBoundingClientRect())
    spark(x, y, hue)
    playLand()
    target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.16)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.2,1.4,.4,1)' })
  }
  fly({ ...from, size }, { ...center(to), size: 9 }, hue, land, 120)
  setTimeout(land, 1400)
}

/** Celebrate a finished subset, set, or whole deck. Returns false when nothing was finished. */
function milestones(c: Case, wait = 0, undo?: () => void): boolean {
  const sub = subById.get(c.sub)!
  const set = setById.get(c.set)!
  const deck = deckById.get(c.deck)!
  if (getStats(deck.id).bySub.get(sub.id) !== sub.cases.length) return false
  setTimeout(() => {
    const { learned, bySet } = getStats(deck.id)
    if (learned === deck.cases.length) finale.set(deck.id)
    else if (!deck.flat && bySet.get(set.id) === set.cases.length) finale.set(set.id)
    else {
      playSubset()
      glow(sub.id)
      say({ text: `${subName(sub)} complete`, sub: sub.id, cells: sub.cases.length, undo }, undo ? 7000 : 4600)
      return
    }
    playSet()
  }, wait)
  return true
}

function glow(sub: string) {
  ripple.set(sub)
  setTimeout(() => ripple.get() === sub && ripple.set(null), 1800)
}

/** Mark several cases at once, one after another. */
export function learnMany(ids: string[]) {
  const todo = ids.filter((id) => statusOf(id) !== 2)
  if (!todo.length) return
  const first = caseById.get(todo[0])!
  const of = todo.length
  const before = new Map(todo.map((id) => [id, statusOf(id)]))
  const gap = 58
  todo.forEach((id, i) =>
    setTimeout(
      () => {
        playStep(i, of)
        setStatus([id], 2)
        const svg = picture(id)
        if (svg && !calm()) {
          ring(svg.getBoundingClientRect(), hueOf(first.sub), { reach: 16, width: 2 })
          solveDiagram(svg, caseById.get(id)!.ll, { there: 220, hold: 260, back: 360 })
        }
      },
      calm() ? 0 : i * gap,
    ),
  )
  const undo = () => {
    for (const [id, s] of before) setStatus([id], s)
    playUndo()
  }
  setTimeout(
    () => {
      if (!milestones(first, 0, undo)) say({ text: `${of} marked as learned`, undo }, 7000)
    },
    (calm() ? 0 : of * gap) + 260,
  )
}

/** Any other status change. */
export function change(id: string, s: Status, pace: 'full' | 'quick' = 'full', from?: Element) {
  if (s === 2) return learn(id, pace, from)
  const before = statusOf(id)
  if (before === s) return
  const undo = setStatus([id], s)
  if (s === 1) playLearning()
  else playUndo()
  if (before === 2) say({ text: `${caseById.get(id)!.name} is no longer marked as learned`, undo })
}
