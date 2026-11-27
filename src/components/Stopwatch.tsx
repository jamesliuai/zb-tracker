import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { covered } from '../lib/layers.ts'
import { clock } from '../lib/text.ts'
import { playStart } from '../reward/sound.ts'

export type Phase = 'idle' | 'armed' | 'running'

interface Hands {
  /** Whether there's anything to time right now with space or a finger. False while a smart cube runs the clock. */
  ready: () => boolean
  /** The clock was stopped after `cs` hundredths, by hand or by a smart cube. A slip of the finger never gets here. */
  stopped: (cs: number, by: 'hand' | 'cube') => void
  /** Escape called the clock off. */
  off?: () => void
  /** Keys besides space that do something while the clock is still, in lowercase. */
  keys?: string[]
  /** One of those keys was pressed, or space when there's nothing to time. */
  press?: (key: string) => void
  /** False while something on top has the keys instead. */
  mine?: () => boolean
}

/**
 * A speedcubing timer. Hold space, or a finger on the pad, and let go to start; any key or a tap
 * anywhere stops it, and Escape calls it off. While it runs the time counts on its own, frame by
 * frame, and the page is told, so everything else can step back. A smart cube starts it with `go`
 * and stops it with `halt`, with the time it measured itself.
 *
 * Spread `pad` onto the clock, set `face` on the element that shows the running time, and render
 * `cover` anywhere, which is there while a tap can stop the clock.
 */
export function useStopwatch(hands: Hands) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [catching, setCatching] = useState(false)
  const from = useRef(0)
  const face = useRef<HTMLSpanElement>(null)
  const o = useRef(hands)
  o.current = hands
  const running = phase === 'running'

  useLayoutEffect(() => {
    if (!running) return
    const root = document.documentElement
    root.dataset.timing = ''
    const show = () => {
      if (face.current) face.current.textContent = clock(Math.floor((performance.now() - from.current) / 10))
    }
    show()
    let f = requestAnimationFrame(function tick() {
      show()
      f = requestAnimationFrame(tick)
    })
    return () => {
      cancelAnimationFrame(f)
      delete root.dataset.timing
    }
  }, [running])

  // the cover goes once the stopping tap's click lands on it, or soon anyway if none comes
  useEffect(() => {
    if (!catching) return
    const t = setTimeout(() => setCatching(false), 500)
    return () => clearTimeout(t)
  }, [catching])

  // Events read the phase from here, so a tap quicker than a frame still starts and stops the clock.
  const at = useRef<Phase>('idle')
  const set = (p: Phase) => {
    at.current = p
    setPhase(p)
  }
  const arm = () => {
    if (at.current === 'idle' && o.current.ready()) set('armed')
  }
  const start = (t: number) => {
    if (at.current !== 'armed') return
    from.current = t
    set('running')
    playStart()
  }
  const stop = (t: number) => {
    if (at.current !== 'running') return
    set('idle')
    const cs = Math.floor((t - from.current) / 10)
    // a slip of the finger is as good as calling it off
    if (cs >= 30) o.current.stopped(cs, 'hand')
    else o.current.off?.()
  }
  /** Started by a smart cube, from the turn that set it off. False if it was going already. */
  const go = (t: number) => {
    if (at.current === 'running') return false
    from.current = t
    set('running')
    playStart()
    return true
  }
  /** Stopped by a smart cube, with the time by its own clock. */
  const halt = (cs: number) => {
    if (at.current !== 'running') return
    set('idle')
    o.current.stopped(cs, 'cube')
  }

  useEffect(() => {
    const own = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }
    const mine = () => (o.current.mine ? o.current.mine() : !covered())
    const typing = (e: KeyboardEvent) => (e.target as HTMLElement).closest?.('input, textarea')
    const down = (e: KeyboardEvent) => {
      if (!mine() || e.metaKey || e.ctrlKey || e.altKey || typing(e)) return
      if (at.current === 'running') {
        if (e.key === 'Shift' || e.key === 'CapsLock') return
        own(e)
        // a key held down since before the clock started isn't the one stopping it
        if (e.repeat) return
        if (e.key === 'Escape') {
          // called off, and it doesn't count
          set('idle')
          o.current.off?.()
        } else stop(e.timeStamp)
        return
      }
      const k = e.key.toLowerCase()
      if (k !== ' ' && !o.current.keys?.includes(k)) return
      own(e)
      // holding a key down does it once
      if (e.repeat) return
      if (k === ' ' && o.current.ready()) arm()
      else o.current.press?.(k)
    }
    const up = (e: KeyboardEvent) => {
      if (e.key !== ' ' || !mine() || typing(e)) return
      own(e)
      start(e.timeStamp)
    }
    const lost = () => at.current === 'armed' && set('idle')
    addEventListener('keydown', down, true)
    addEventListener('keyup', up, true)
    addEventListener('blur', lost)
    return () => {
      removeEventListener('keydown', down, true)
      removeEventListener('keyup', up, true)
      removeEventListener('blur', lost)
    }
    // they only read refs, so one set of them lasts as long as the clock is on screen
  }, [])

  const pad = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      // a button on the pad, like Connect, is pressed for itself, not to start the clock
      if (e.button || at.current !== 'idle' || !o.current.ready() || (e.target as Element).closest('button, a')) return
      e.currentTarget.setPointerCapture(e.pointerId)
      arm()
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => start(e.timeStamp),
    onPointerCancel: () => at.current === 'armed' && set('idle'),
  }

  // while timing, a touch anywhere stops the clock, and the click it makes lands here too, not on what appears underneath
  const cover =
    running || catching ? (
      <div
        className="stage__catch"
        onPointerDown={(e) => {
          if (at.current !== 'running') return
          e.currentTarget.setPointerCapture(e.pointerId)
          setCatching(true)
          stop(e.timeStamp)
        }}
        onClick={() => setCatching(false)}
        onPointerCancel={() => setCatching(false)}
      />
    ) : null

  return { phase, face, pad, cover, go, halt }
}
