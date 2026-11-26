import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Alg, Auf } from '../components/Alg.tsx'
import { Cube, Glyph } from '../components/Cube.tsx'
import { Icon } from '../components/Icon.tsx'
import { Roll } from '../components/Roll.tsx'
import { Segmented } from '../components/Segmented.tsx'
import { useStopwatch } from '../components/Stopwatch.tsx'
import { Check } from '../components/Tile.tsx'
import { turnU } from '../cube/engine.ts'
import { caseById, subById, type Deck } from '../data/index.ts'
import { covered } from '../lib/layers.ts'
import { airy, clock, shade, subLine, subWords, when } from '../lib/text.ts'
import { hueOf } from '../reward/celebrate.ts'
import { calm, spark } from '../reward/fx.ts'
import { playStop, playSubset, playUndo } from '../reward/sound.ts'
import { chosen, need, tipFor } from '../state/choose.ts'
import { anglesOf, setPrefs, useCases, useEntry, usePractice, usePractices, usePrefs, type Pool, type Way } from '../state/store.ts'
import { median, nextDue, plan, type Plan } from '../train/schedule.ts'
import { begin, end, finish, leave, resume, round, toggleMiss, type Attempt, type Round } from '../train/session.ts'

const ways = [['cube', 'With a cube'], ['screen', 'On screen']] as const
const pools = [['due', 'Due'], ['learning', 'Learning'], ['learned', 'Learned'], ['all', 'All']] as const
const touch = typeof matchMedia !== 'undefined' ? matchMedia('(pointer: coarse)') : null
/** A picture with nothing lit, for a case you haven't seen yet. */
const blank = (ll: string) => 'X'.repeat(ll.length)
const effort = [0, 1, 2, 1]

/** Going between setting up, training and the results is a change of page, so it looks like one. */
function swap(change: () => void) {
  if (!document.startViewTransition || calm() || document.hidden) {
    change()
    scrollTo({ top: 0, behavior: 'instant' })
    return
  }
  document.documentElement.dataset.nav = 'page'
  const t = document.startViewTransition(() => {
    flushSync(change)
    scrollTo({ top: 0, behavior: 'instant' })
  })
  // a transition cut short, say by the window resizing, still makes the change
  t.ready.catch(() => {})
  t.finished.catch(() => {})
}

const sub = (id: string) => subById.get(caseById.get(id)!.sub)!

/* ------------------------------------------------------------------ choosing what to train */

function blurb(deck: Deck, pool: Pool, p: Plan): string {
  const n = p.ids.length
  if (pool === 'due') {
    if (!n) {
      const soon = nextDue(deck)
      return soon === null ? 'Nothing to train yet. Mark the cases you’re learning, or pick some below.' : `All caught up. The next refresher is due ${when(soon)}.`
    }
    const review = n - p.learning
    const parts = [p.learning === 1 ? 'The case you’re learning' : p.learning ? `The ${p.learning} you’re learning` : '', review ? `${review} learned ${review === 1 ? 'case' : 'ones'} due for a refresher` : ''].filter(Boolean)
    const later = p.later ? ` ${p.later} more ${p.later === 1 ? 'is' : 'are'} due after this round.` : ''
    return `${parts.join(', and ')}.${later}`
  }
  if (pool === 'learning') return n ? 'Every case you’re learning.' : 'You’re not learning any right now. Mark a case as learning on its page, or pick some below.'
  if (pool === 'learned') return n ? 'Every case you’ve learned.' : 'Nothing learned yet. Pick some cases below instead.'
  if (pool === 'all') return `Every case in ${deck.id}.`
  return n ? 'The cases picked below.' : 'Pick some cases below.'
}

/** Pressing a group adds all of it, or takes it all away when it's all in already. */
function useFlip(deck: Deck, on: Set<string>) {
  const prefs = usePrefs()
  return (ids: string[]) => {
    const full = ids.every((id) => on.has(id))
    const next = new Set(on)
    ids.forEach((id) => (full ? next.delete(id) : next.add(id)))
    const mine = deck.cases.filter((c) => next.has(c.id)).map((c) => c.id)
    setPrefs({ pool: { ...prefs.pool, [deck.id]: 'pick' }, pick: [...prefs.pick.filter((id) => caseById.get(id)!.deck !== deck.id), ...mine] })
  }
}

const pressed = (ids: string[], on: Set<string>) => {
  const k = ids.filter((id) => on.has(id)).length
  return k === ids.length ? true : k ? ('mixed' as const) : false
}

function Chooser({ deck, on }: { deck: Deck; on: Set<string> }) {
  const flip = useFlip(deck, on)
  return (
    <div className="choose">
      {deck.sets.map((set) => {
        const ids = set.cases.map((c) => c.id)
        return (
          <div key={set.id} className="choose__set" data-set={set.id}>
            <button className="choose__name" aria-pressed={pressed(ids, on)} onClick={() => flip(ids)}>
              {!deck.flat && <Glyph ll={set.cases[0].ll} />}
              <b>{deck.flat ? set.short : set.name}</b>
              <span className="num">{ids.filter((id) => on.has(id)).length || ''}</span>
            </button>
            <div className={deck.flat ? 'choose__chips choose__chips--cases' : 'choose__chips'}>
              {deck.flat
                ? set.cases.map((c) => (
                    <button key={c.id} className="chip chip--case" {...shade(sub(c.id))} aria-pressed={on.has(c.id)} onClick={() => flip([c.id])} aria-label={c.name}>
                      <Cube ll={c.ll} />
                      <b>{c.short}</b>
                    </button>
                  ))
                : set.subs.map((s) => {
                    const mine = s.cases.map((c) => c.id)
                    return (
                      <button key={s.id} className="chip" {...shade(s)} aria-pressed={pressed(mine, on)} onClick={() => flip(mine)} title={subLine(s)}>
                        <span className="chip__name">
                          <b>{s.short}</b> {airy(s.name)}
                        </span>
                        <span className="chip__cells" aria-hidden="true">
                          {mine.map((id) => (
                            <i key={id} className="cell" data-s={on.has(id) ? 2 : 0} />
                          ))}
                        </span>
                      </button>
                    )
                  })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** The cases that have been slowest lately, to go straight at them. */
function Slowest({ deck, way }: { deck: Deck; way: Way }) {
  const practice = usePractices()
  const list = deck.cases
    .filter((c) => (practice[c.id]?.times?.length ?? 0) >= 2)
    .map((c) => ({ c, t: median(practice[c.id]!.times!) }))
    .sort((a, b) => b.t - a.t)
    .slice(0, 8)
  if (list.length < 4) return null
  return (
    <section className="slow">
      <div className="slow__head">
        <h2>Slowest lately</h2>
        <button className="quiet" onClick={() => swap(() => begin(deck.id, list.map((x) => x.c.id), way))}>
          <Icon name="timer" size={14} /> Train these {list.length}
        </button>
      </div>
      <div className="slow__tiles">
        {list.map(({ c, t }) => (
          <a key={c.id} className="slow__tile" href={`#${c.id}`} data-case={c.id} {...shade(sub(c.id))}>
            <Cube ll={c.ll} />
            <b>{c.name.replace(/ perm$/, '')}</b>
            <span className="num">{clock(t)}</span>
          </a>
        ))}
      </div>
    </section>
  )
}

function Setup({ deck }: { deck: Deck }) {
  const prefs = usePrefs()
  useCases()
  usePractices()
  const pool = prefs.pool[deck.id] ?? 'due'
  const p = plan(deck, pool, prefs.pick)
  const n = p.ids.length
  const start = () => n && swap(() => begin(deck.id, p.ids, prefs.way))

  // Space starts, the same as it starts the clock
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== ' ' || e.repeat || e.metaKey || e.ctrlKey || e.altKey || covered()) return
      if ((e.target as HTMLElement).closest?.('input, textarea, button, a, [tabindex]')) return
      e.preventDefault()
      start()
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  })

  return (
    <main className="train">
      <section className="hero">
        <div className="hero__count">
          <h1>
            <Roll value={n} />
            <span className="hero__of">
              {n === 1 ? 'case' : 'cases'}
              <br />
              to train
            </span>
          </h1>
          <p>{blurb(deck, pool, p)}</p>
        </div>
        <div className="go">
          <Segmented label="Train" value={prefs.way} options={ways} onChange={(way) => setPrefs({ way })} />
          <p>{prefs.way === 'cube' ? 'Each case comes as a scramble. Do it on a solved cube, then solve the case against the clock.' : 'Each case comes as a picture. Stop the clock the moment you know its algorithm.'}</p>
          <button className="btn btn--main" disabled={!n} onClick={start} title="Start  Space">
            Start
          </button>
        </div>
      </section>

      <section className="scope">
        <div className="scope__head">
          <h2>What to train</h2>
          <Segmented label="What to train" value={pool === 'pick' ? null : pool} options={pools} onChange={(v) => setPrefs({ pool: { ...prefs.pool, [deck.id]: v } })} />
        </div>
        <Chooser deck={deck} on={new Set(p.ids)} />
      </section>

      <Slowest deck={deck} way={prefs.way} />

      <footer className="foot">
        <p>
          A scramble never undoes an algorithm for the case it sets up, so you have to recognize the case from the cube. Each case you get comes back after a longer gap than last time, and anything you miss comes back
          sooner. Times are kept with the rest of your progress, in this browser.
        </p>
      </footer>
    </main>
  )
}

/* ------------------------------------------------------------------ the clock */

/** One light per case in the round. It fills in the case's color once it's done. */
function Lights({ r, wave = false }: { r: Round; wave?: boolean }) {
  const got = new Set(r.done.filter((a) => !a.missed).map((a) => a.id))
  const missed = new Set(r.done.filter((a) => a.missed).map((a) => a.id))
  return (
    <div className={wave ? 'lights is-waving' : 'lights'} aria-hidden="true" data-many={r.ids.length > 48 || undefined}>
      {r.ids.map((id, i) => {
        const look = shade(sub(id))
        return <i key={id} className="cell" data-s={got.has(id) ? 2 : missed.has(id) ? 1 : 0} {...look} style={{ ...look.style, '--i': i } as React.CSSProperties} />
      })}
    </div>
  )
}

/** The case just done: what it was, seen the way it came up, and the algorithm for that side. */
function Reveal({ a, way, onMiss }: { a: Attempt; way: Way; onMiss: () => void }) {
  const c = caseById.get(a.id)!
  const s = sub(a.id)
  const { hand } = usePrefs()
  const angles = anglesOf(useEntry(c.id))
  const p = usePractice(c.id)
  // with two angles, the one that needs the least AUF from here
  const best = angles
    .map((angle, i) => {
      const pick = chosen(c, angle, hand)
      return { angle, i, pick, turn: need(c, pick.text, a.view) ?? pick.need }
    })
    .reduce((x, y) => (effort[y.turn] < effort[x.turn] ? y : x))
  const typical = p?.times && p.times.length >= 3 ? median(p.times) : null
  const tip = tipFor(c, best.pick.text)
  return (
    <article className="reveal" data-case={c.id} data-missed={a.missed || undefined} {...shade(s)}>
      <a className="reveal__pic" href={`#${c.id}`} aria-label={`Open ${c.name}`}>
        <Cube ll={c.ll} rot={a.view} />
      </a>
      <div className="reveal__body">
        <p className="reveal__name">
          <a href={`#${c.id}`}>{c.name}</a>
          <span>{subWords(s)}</span>
          {angles.length > 1 && <small>Angle {'AB'[best.i]}</small>}
        </p>
        <p className="reveal__alg">
          <Auf turn={best.turn} />
          <Alg text={best.pick.text} />
        </p>
        {best.angle.rec && <p className="reveal__note">{best.angle.rec}</p>}
        {tip && <p className="reveal__note reveal__note--tip">{tip}</p>}
      </div>
      <div className="reveal__side">
        {way === 'cube' && (
          <p className="reveal__stats num">
            {a.best && !a.missed ? <em>Fastest yet</em> : p?.best && (p.times?.length ?? 0) > 1 ? <>Best {clock(p.best)}</> : null}
            {typical !== null && <span>Usually {clock(typical)}</span>}
          </p>
        )}
        <button className="btn reveal__miss" aria-pressed={a.missed} onClick={onMiss} title={a.missed ? 'Take it back  M' : 'It comes back in a few cases  M'}>
          {a.missed ? 'Missed' : 'Missed it'}
          <kbd>M</kbd>
        </button>
      </div>
    </article>
  )
}

function Stage({ r }: { r: Round }) {
  const time = useRef<HTMLDivElement>(null)
  const last = r.done.at(-1)
  const next = r.next
  const screen = r.way === 'screen'
  const got = new Set(r.done.filter((a) => !a.missed).map((a) => a.id)).size
  const miss = () => {
    if (toggleMiss()) playUndo()
  }
  const { phase, face, pad, cover } = useStopwatch({
    ready: () => !!round.get()?.next,
    stopped: (cs) => {
      const a = finish(cs)
      if (!a) return
      playStop(a.best)
      navigator.vibrate?.(8)
      if (a.best && !calm())
        requestAnimationFrame(() => {
          const b = time.current?.getBoundingClientRect()
          if (b) spark(b.x + b.width / 2, b.y + b.height / 2, hueOf(caseById.get(a.id)!.sub), 12, Math.min(150, b.width * 0.42))
        })
    },
    // Escape ends the round, and so does space once every case is done
    keys: ['m', 'escape'],
    press: (k) => (k === 'm' ? miss() : swap(end)),
  })
  const running = phase === 'running'

  const c = next && caseById.get(next.id)!
  const tap = touch?.matches
  const hint = !next
    ? ''
    : phase === 'armed'
      ? screen
        ? 'Let go to see the case'
        : 'Let go to start'
      : running
        ? screen
          ? tap
            ? 'Tap when you know it'
            : 'Any key when you know it'
          : ''
        : screen
          ? tap
            ? 'Touch and hold, let go to see the case'
            : 'Hold space, let go to see the case'
          : r.done.length
            ? tap
              ? 'Touch and hold, let go to start'
              : 'Hold space, let go to start'
            : tap
              ? 'Scramble with yellow on top. Then touch and hold, and let go to start.'
              : 'Scramble with yellow on top. Then hold space, and let go to start.'

  return (
    <main className="train stage" data-phase={phase} data-way={r.way}>
      <div className="crumbs stage__fade">
        <p className="stage__count">
          <b className="num">{got}</b> of {r.ids.length}
        </p>
        <div className="crumbs__step">
          <button className="tool" onClick={() => swap(end)} aria-label="End the round" title="End the round  Esc">
            <Icon name="close" />
          </button>
        </div>
      </div>
      <Lights r={r} />

      <div className="stage__main">
        <div className="stage__prompt">
          {!c ? (
            <div className="stage__done">
              <p>That’s every case in the round.</p>
              <button className="btn btn--main" onClick={() => swap(end)}>
                See how it went
              </button>
            </div>
          ) : screen ? (
            <div className="stage__card" data-lit={running || undefined}>
              <Cube ll={running ? turnU(c.ll, next.view) : blank(c.ll)} label={running ? 'The case to recall' : undefined} />
            </div>
          ) : (
            <p className="stage__scramble" aria-label={`Scramble: ${next.moves}`}>
              <Alg text={next.moves ?? ''} />
            </p>
          )}
        </div>

        <div className="stage__pad" {...pad}>
          <div
            ref={time}
            className="stage__time num"
            {...(last ? shade(sub(last.id)) : {})}
            data-best={(last?.best && !last.missed && phase === 'idle') || undefined}
            data-missed={(last?.missed && phase === 'idle') || undefined}
          >
            {running ? <span ref={face} /> : <span>{phase === 'armed' || !last ? '0.00' : clock(last.cs)}</span>}
          </div>
          <p className="stage__hint">{hint}</p>
        </div>

        <div className="stage__last stage__fade">{last && <Reveal key={last.at} a={last} way={r.way} onMiss={miss} />}</div>
      </div>

      {cover}
      <p className="sr" aria-live="polite">
        {last && phase === 'idle' ? `${caseById.get(last.id)!.name}, ${clock(last.cs)}${last.missed ? ', missed' : ''}` : ''}
      </p>
    </main>
  )
}

/* ------------------------------------------------------------------ how it went */

interface Row {
  id: string
  cs: number | null
  /** Times it was missed in the round. */
  missed: number
  best: boolean
}

function Summary({ r }: { r: Round }) {
  const again = useRef<HTMLButtonElement>(null)
  const [wave, setWave] = useState(false)
  const rows: Row[] = r.ids
    .filter((id) => r.done.some((a) => a.id === id))
    .map((id) => {
      const tries = r.done.filter((a) => a.id === id)
      const got = tries.findLast((a) => !a.missed)
      return { id, cs: got ? got.cs : null, missed: tries.filter((a) => a.missed).length, best: !!got?.best }
    })
  const timed = rows.filter((x) => x.cs !== null)
  const mean = timed.length ? timed.reduce((t, x) => t + x.cs!, 0) / timed.length : null
  const order = [...rows].sort((a, b) => (b.cs ?? Infinity) - (a.cs ?? Infinity))
  const most = Math.max(...timed.map((x) => x.cs!), 1)
  const weak = order.slice(0, Math.min(8, Math.max(3, Math.ceil(rows.length / 3))))
  const left = new Set(r.queue).size

  useEffect(() => {
    again.current?.focus({ preventScroll: true })
    if (!r.complete) return
    playSubset()
    if (calm()) return
    setWave(true)
    const t = setTimeout(() => setWave(false), 1800)
    return () => clearTimeout(t)
  }, [r])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (covered()) return
      // a key still held from the round would otherwise press the button that has just taken focus
      if (e.repeat && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) {
        e.preventDefault()
        e.stopPropagation()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        swap(leave)
      }
    }
    addEventListener('keydown', key, true)
    return () => removeEventListener('keydown', key, true)
  }, [])

  const mins = Math.round((r.done.at(-1)!.at - r.start) / 60_000)
  const fastest = [...timed].sort((a, b) => a.cs! - b.cs!)[0]
  const bests = rows.filter((x) => x.best).length
  const missed = rows.filter((x) => x.missed).length
  const story = [
    `${rows.length} ${rows.length === 1 ? 'case' : 'cases'} in ${mins < 1 ? 'under a minute' : mins === 1 ? 'a minute' : `${mins} minutes`}.`,
    fastest && rows.length > 1 ? `${caseById.get(fastest.id)!.name} was the fastest, at ${clock(fastest.cs!)}.` : '',
    bests ? (bests === 1 ? 'One new best.' : `${bests} new bests.`) : '',
    missed ? (missed === 1 ? 'One missed.' : `${missed} missed.`) : '',
  ]

  return (
    <main className="train tally">
      <section className="hero">
        <div className="hero__count">
          <h1>
            {mean === null ? rows.length : clock(mean)}
            <span className="hero__of">
              {mean === null ? (rows.length === 1 ? 'case' : 'cases') : 'seconds'}
              <br />
              {mean === null ? 'missed' : r.way === 'cube' ? 'on average' : 'to recall'}
            </span>
          </h1>
          <p>{story.filter(Boolean).join(' ')}</p>
        </div>
        <div className="go">
          {left ? (
            <button ref={again} className="btn btn--main" onClick={() => swap(resume)}>
              Finish the other {left}
            </button>
          ) : (
            <button ref={again} className="btn btn--main" onClick={() => swap(() => begin(r.deck, r.ids, r.way))}>
              Go again
            </button>
          )}
          {rows.length > 4 && (
            <button className="btn" onClick={() => swap(() => begin(r.deck, weak.map((x) => x.id), r.way))}>
              Just the slowest {weak.length}
            </button>
          )}
          <button className="quiet" onClick={() => swap(leave)}>
            Done
          </button>
        </div>
      </section>

      <Lights r={r} wave={wave} />

      <div className="tally__rows">
        {order.map((x) => {
          const c = caseById.get(x.id)!
          const s = sub(x.id)
          return (
            <div key={x.id} className="tally__row" data-case={x.id} data-got={x.cs !== null || undefined} {...shade(s)}>
              <a className="tally__case" href={`#${x.id}`}>
                <Cube ll={c.ll} />
                <b>{c.name}</b>
                <span>{subWords(s)}</span>
              </a>
              <span className="tally__bar" aria-hidden="true">
                <b style={{ scale: `${x.cs === null ? 1 : x.cs / most} 1` }} />
              </span>
              <span className="tally__time num">
                {x.cs === null ? 'Missed' : clock(x.cs)}
                {x.best ? <em>Best</em> : x.missed && x.cs !== null ? <i>Missed {x.missed === 1 ? 'once' : x.missed === 2 ? 'twice' : `${x.missed} times`}</i> : null}
              </span>
              <Check id={x.id} />
            </div>
          )
        })}
      </div>
    </main>
  )
}

/* ------------------------------------------------------------------ the page */

export function TrainPage({ deck }: { deck: Deck }) {
  const r = round.use()
  if (!r || r.deck !== deck.id) return <Setup deck={deck} />
  return r.over ? <Summary key={r.n} r={r} /> : <Stage key={r.n} r={r} />
}
