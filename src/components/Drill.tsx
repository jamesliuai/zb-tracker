import { useEffect, useMemo, useRef, useState } from 'react'
import { isSolved, moveCount, plain, setup, solves, undo } from '../cube/engine.ts'
import { caseById, deckById, subById, type Case } from '../data/index.ts'
import { clock, shade, subWords } from '../lib/text.ts'
import { hueOf } from '../reward/celebrate.ts'
import { calm, spark } from '../reward/fx.ts'
import { drilling } from '../reward/signals.ts'
import { playStop, playUndo } from '../reward/sound.ts'
import { canConnect, link } from '../smart/connect.ts'
import { useFollow } from '../smart/follow.ts'
import { tokens } from '../smart/guide.ts'
import { elapsed } from '../smart/solve.ts'
import { chosen } from '../state/choose.ts'
import { anglesOf, getEntry, getData, useDrills } from '../state/store.ts'
import { average, lap, unlap, type Lap } from '../train/drill.ts'
import { Alg, Turns } from './Alg.tsx'
import { Cube } from './Cube.tsx'
import { Icon } from './Icon.tsx'
import { CubeButton } from './SmartCube.tsx'
import { useStopwatch } from './Stopwatch.tsx'

const touch = typeof matchMedia !== 'undefined' ? matchMedia('(pointer: coarse)') : null

/** The algorithm a case is done with, as it shows in lists. */
const usual = (c: Case) => chosen(c, anglesOf(getEntry(c.id))[0], getData().prefs.hand).text

export function Drill() {
  const on = drilling.use()
  return on ? <Session id={on.id} text={on.text} /> : null
}

function Stat({ label, cs }: { label: string; cs: number | null | undefined }) {
  return (
    <p>
      <small>{label}</small>
      <b className="num" data-none={!cs || undefined}>
        {cs ? clock(cs) : '–'}
      </b>
    </p>
  )
}

/** Faster or slower than the best before it, the way a timer says it. */
const signed = (cs: number) => `${cs < 0 ? '−' : '+'}${clock(Math.abs(cs))}`

/**
 * One algorithm against the clock, again and again. Set the case up, then time just the algorithm.
 * Every time is saved with the algorithm, and the fastest is the one to beat. A smart cube follows
 * the setup, starts the clock on the first turn of the algorithm and stops it once it's solved,
 * and keeps times of its own.
 */
function Session({ id, text }: { id: string; text: string }) {
  const c = caseById.get(id)!
  const sub = subById.get(c.sub)!
  const deck = deckById.get(c.deck)!
  const smart = link.use().state === 'on'
  const d = useDrills(id, smart)[text]
  const [laps, setLaps] = useState<Lap[]>([])
  const [full, setFull] = useState(() => !!document.fullscreenElement)
  const box = useRef<HTMLDivElement>(null)
  const time = useRef<HTMLDivElement>(null)
  // what was focused when it opened, to go back to
  const opener = useRef(document.activeElement as HTMLElement | null)
  const last = laps.findLast((l) => l.id === id && l.text === text)
  const near = deck.flat ? deck.cases : sub.cases
  const before = near[near.indexOf(c) - 1]
  const after = near[near.indexOf(c) + 1]

  const close = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    drilling.set(null)
  }
  const move = (to: Case | undefined) => to && drilling.set({ id: to.id, text: usual(to) })
  const drop = () => {
    if (!last || !unlap(last)) return
    setLaps((list) => list.filter((l) => l !== last))
    playUndo()
  }

  const calledOff = useRef(() => {})
  // the smart cube started the clock that's running
  const cubeRan = useRef(false)
  const { phase, face, pad, cover, go, halt } = useStopwatch({
    // a smart cube starts the clock itself, on the first turn
    ready: () => link.get().state !== 'on',
    stopped: (cs, by) => {
      // what the cube started, only the cube can say is done, even if it dropped out
      const cut = by === 'hand' && cubeRan.current
      cubeRan.current = false
      if (cut) return calledOff.current()
      const l = lap(id, text, cs, by === 'cube')
      setLaps((list) => [...list, l])
      playStop(l.best)
      navigator.vibrate?.(8)
      if (l.best && !calm())
        requestAnimationFrame(() => {
          const b = time.current?.getBoundingClientRect()
          if (b) spark(b.x + b.width / 2, b.y + b.height / 2, hueOf(c.sub), 14, Math.min(170, b.width * 0.45))
        })
    },
    keys: ['escape', 'backspace', 'delete', 'arrowleft', 'arrowright'],
    press: (k) => (k === 'escape' ? close() : k === 'arrowleft' ? move(before) : k === 'arrowright' ? move(after) : k === ' ' ? undefined : drop()),
    // the page underneath is asleep, so the keys are all ours, unless a dialog is open on top, like the one asking for a cube's address
    mine: () => !document.querySelector('dialog[open]'),
    off: () => {
      cubeRan.current = false
      calledOff.current()
    },
  })
  // on a smart cube, the setup is the algorithm's own turns taken back, whatever grip it ends in
  const undone = useMemo(() => undo(plain(text)).join(' '), [text])
  const follow = useFollow(() => (link.get().state === 'on' ? { key: `${id}\n${text}`, moves: undone, start: 'first', over: isSolved } : null), {
    begin: (t) => {
      cubeRan.current = go(t)
    },
    end: (start, turns) => halt(Math.round(elapsed([start, ...turns]).at(-1)! / 10)),
  })
  calledOff.current = follow.reset
  const now = follow.now
  const running = phase === 'running'

  useEffect(() => {
    box.current?.focus({ preventScroll: true })
    const change = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', change)
    const back = opener.current
    return () => {
      document.removeEventListener('fullscreenchange', change)
      back?.focus({ preventScroll: true })
    }
  }, [])

  // the picture the way the algorithm starts, with no AUF to do first
  const turn = solves(text, c.ll)[0] ?? 0
  const times = d ? [...d.times].reverse() : []
  const fastest = d ? times.indexOf(d.best) : -1
  const ao5 = d && average(d.times, 5)
  const ao12 = d && average(d.times, 12)
  const tap = touch?.matches
  const hint =
    phase === 'armed'
      ? 'Let go to start'
      : running
        ? ''
        : smart
          ? now.is === 'wait'
            ? 'Solve your cube to set it up'
            : now.is === 'ready'
              ? 'Set up. The clock starts on your first turn.'
              : 'Set it up with yellow on top'
          : tap
            ? 'Set it up, then touch and hold, and let go to start'
            : 'Set it up, then hold space, and let go to start'
  // how fast it was turned, for a time the cube took
  const tps = last?.smart && last.cs ? moveCount(text) / (last.cs / 100) : null
  const look = shade(sub)

  return (
    <div
      ref={box}
      className="drill"
      data-phase={phase}
      {...look}
      role="dialog"
      aria-modal="true"
      aria-label={`Time ${c.name}`}
      tabIndex={-1}
    >
      <div className="drill__top drill__fade">
        <p className="drill__name">
          <b>{c.name}</b> <span>{subWords(sub)}</span>
        </p>
        {canConnect && <CubeButton />}
        {document.fullscreenEnabled && (
          <button
            className="tool"
            onClick={() => (full ? document.exitFullscreen() : box.current?.requestFullscreen())?.catch(() => {})}
            aria-label={full ? 'Leave full screen' : 'Full screen'}
            title={full ? 'Leave full screen' : 'Full screen'}
          >
            <Icon name={full ? 'shrink' : 'expand'} />
          </button>
        )}
        <button className="tool" onClick={close} aria-label="Close" title="Close  Esc">
          <Icon name="close" />
        </button>
      </div>

      <div className="drill__main">
        <div className="drill__case drill__fade">
          <Cube key={c.id} ll={c.ll} rot={turn} />
        </div>
        <p className="drill__alg">
          <Alg text={text} />
        </p>
        <p className="drill__setup drill__fade" data-done={(smart && now.is === 'ready') || undefined} data-wait={(smart && now.is === 'wait') || undefined}>
          <span>Setup</span> {smart && now.is === 'setup' && now.guide.moves.join(' ') === undone ? <Turns list={tokens(now.guide)} /> : <Alg text={smart ? undone : setup(text)} />}
        </p>

        <div className="drill__pad" {...pad}>
          <div ref={time} className="drill__time num" data-best={(last?.best && phase === 'idle') || undefined}>
            {running ? <span ref={face} /> : <span>{phase === 'armed' || !last ? '0.00' : clock(last.cs)}</span>}
          </div>
          <p className="drill__said drill__fade" aria-live="polite">
            {last && phase === 'idle' && (last.best ? <em key={last.after.at}>New best</em> : last.before ? <span>{signed(last.cs - last.before.best)} on your best</span> : <span>Your first time</span>)}
          </p>
          {tps !== null && <p className="drill__tps drill__fade num">{phase === 'idle' ? `${tps.toFixed(1)} turns a second` : ''}</p>}
          <p className="drill__hint">{hint}</p>
        </div>

        <div className="drill__stats drill__fade">
          <Stat label="Best" cs={d?.best} />
          <Stat label="Average of 5" cs={ao5} />
          <Stat label="Average of 12" cs={ao12} />
          <p>
            <small>Timed</small>
            <b className="num">{d ? d.n : 0}</b>
          </p>
        </div>
        {times.length > 0 && (
          <ol className="drill__times drill__fade num" aria-label="Latest times, newest first">
            {times.map((cs, i) => (
              <li key={d!.n - i} className={i === fastest ? 'is-best' : undefined}>
                {clock(cs)}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="drill__foot drill__fade">
        <button className="quiet" onClick={() => move(before)} disabled={!before} title="Previous case  ←">
          <Icon name="left" size={14} /> {before?.name}
        </button>
        {last && (
          <button className="quiet" onClick={drop} title="Take back the last time  ⌫">
            Drop the last time
          </button>
        )}
        <button className="quiet" onClick={() => move(after)} disabled={!after} title="Next case  →">
          {after?.name} <Icon name="right" size={14} />
        </button>
      </div>
      {cover}
    </div>
  )
}
