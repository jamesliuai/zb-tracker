import { useEffect, useRef, useState } from 'react'
import { Alg, Auf } from '../components/Alg.tsx'
import { Steps } from '../components/Cells.tsx'
import { Cube } from '../components/Cube.tsx'
import { Icon } from '../components/Icon.tsx'
import { Note } from '../components/Note.tsx'
import { Segmented } from '../components/Segmented.tsx'
import { NotationError, isSlot, moveCount, normalize, parse, setup, type Turn } from '../cube/engine.ts'
import { caseById, deckById, type Case, type Deck, type Subset, type ZSet } from '../data/index.ts'
import { covered } from '../lib/layers.ts'
import { go, homeOf } from '../lib/router.ts'
import { clock, date, shade, subLine, when } from '../lib/text.ts'
import { change, learn } from '../reward/celebrate.ts'
import { say } from '../reward/signals.ts'
import { playTurn } from '../reward/sound.ts'
import { chosen, need, offers, suggestAngle, tipFor, type Row } from '../state/choose.ts'
import { addAngle, anglesOf, nextUp, removeAngle, setPrefs, solvesOf, touch, updateAngle, updateEntry, useBySmartCube, useDrills, useEntry, usePractice, usePrefs, type Angle, type Entry, type Status } from '../state/store.ts'
import { drill } from '../train/drill.ts'
import { median } from '../train/schedule.ts'

const hands = [['two', 'Two-handed'], ['oh', 'One-handed']] as const
const AB = ['A', 'B']

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className="mini"
      aria-label={done ? 'Copied' : 'Copy algorithm'}
      title={done ? 'Copied' : 'Copy'}
      onClick={async (e) => {
        e.stopPropagation()
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1400)
        } catch {
          say({ text: 'Couldn’t reach the clipboard' })
        }
      }}
    >
      <Icon name={done ? 'check' : 'copy'} />
    </button>
  )
}

const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`)

/** How it has gone in the trainer, once there's something to say. */
function Practised({ id, status }: { id: string; status: Status }) {
  const p = usePractice(id)
  const smart = useBySmartCube()
  if (!p) return null
  const { times: solves, best, look } = solvesOf(p, smart)
  const seeing = look && look.length >= 3 ? `, ${clock(median(look))} of it recognizing` : ''
  const bits = [
    best ? `Best ${clock(best)}${solves.length >= 3 ? `, usually ${clock(median(solves))}${seeing}` : ''}.` : '',
    `Practiced ${times(p.n)}${p.miss ? `, missed ${times(p.miss)}` : ''}.`,
    status === 2 ? (p.due <= Date.now() ? 'Due for a refresher.' : `Next refresher ${when(p.due)}.`) : '',
  ]
  return (
    <div className="note note--tip">
      <span>Training</span>
      <p>{bits.filter(Boolean).join(' ')}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ one angle */

function AngleView({ c, angle, i, of, active, onFocus, children }: { c: Case; angle: Angle; i: number; of: number; active: boolean; onFocus: () => void; children?: React.ReactNode }) {
  const { hand } = usePrefs()
  const [showSetup, setShowSetup] = useState(false)
  const pick = chosen(c, angle, hand)
  const tip = tipFor(c, pick.text)
  const best = useDrills(c.id)[pick.text]?.best
  const turn = () => {
    playTurn()
    updateAngle(c.id, i, { rot: ((angle.rot + 1) % 4) as Turn })
  }
  return (
    <section className={active ? 'angle is-active' : 'angle'} onFocus={onFocus} onClick={onFocus} aria-label={of > 1 ? `Angle ${AB[i]}` : undefined}>
      <div className="angle__view">
        <Cube ll={c.ll} rot={angle.rot} label={isSlot(c.ll) ? `${c.name}, the last layer and the slot under it` : `${c.name} seen from above`} />
        {/* a ZBLS slot stays where it is, so only the top turns */}
        <button className="angle__turn" onClick={turn} aria-label={isSlot(c.ll) ? 'Turn the top' : 'Turn the picture'} title={isSlot(c.ll) ? 'Turn the top  U' : 'See it from another side  U'}>
          <Icon name="turn" />
        </button>
      </div>
      <div className="angle__body">
        {of > 1 && (
          <div className="angle__name">
            <b>Angle {AB[i]}</b>
            {i > 0 && (
              <button
                className="mini"
                aria-label="Remove angle B"
                title="Remove"
                onClick={(e) => {
                  e.stopPropagation()
                  const undo = removeAngle(c.id, i)
                  say({ text: 'Angle B removed', undo }, 6000)
                }}
              >
                <Icon name="close" />
              </button>
            )}
          </div>
        )}
        <p className="angle__alg">
          <Auf turn={pick.need} />
          <Alg text={pick.text} />
        </p>
        <div className="angle__tools">
          <Copy text={pick.text} />
          <button className="quiet" onClick={() => drill(c.id, pick.text)} title="Time this algorithm  S">
            <Icon name="timer" size={14} /> Time it
            {best && (
              <span className="best num" title="Your fastest">
                {clock(best)}
              </span>
            )}
          </button>
          <button className="quiet" aria-expanded={showSetup} onClick={() => setShowSetup(!showSetup)}>
            Setup
          </button>
          {showSetup && (
            <span className="angle__setup">
              <Alg text={setup(pick.text, pick.need ? -pick.need : 0)} />
            </span>
          )}
        </div>
        <div className="notes">
          {tip && (
            <div className="note note--tip">
              <span>Fingertricks</span>
              <p>{tip}</p>
            </div>
          )}
          <Note label="Recognition" value={angle.rec} placeholder="What you look for" onSave={(rec) => updateAngle(c.id, i, { rec })} />
          <Note label="AUF" value={angle.auf} placeholder="How the AUF goes" onSave={(auf) => updateAngle(c.id, i, { auf })} />
          {children}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ choosing an algorithm */

/** Who uses an algorithm, two of them by name and then how many more. */
function Who({ by }: { by: string }) {
  const names = by.split(', ')
  if (names.length < 3) return <small>{by}</small>
  return (
    <small title={by}>
      {names.slice(0, 2).join(', ')} +{names.length - 2}
    </small>
  )
}

function AlgRow({ row, on, best, choose, time, remove }: { row: Row; on: boolean; best?: number; choose: () => void; time: () => void; remove?: () => void }) {
  return (
    <div className={on ? 'pick is-on' : 'pick'}>
      <button role="radio" aria-checked={on} onClick={choose}>
        <span className="pick__dot" />
        <Auf turn={row.need} />
        <span className="pick__alg">
          <Alg text={row.text} />
          {row.tip && !on && <em>{row.tip}</em>}
        </span>
        <span className="pick__meta">
          {row.own && <small>Yours</small>}
          {row.by && <Who by={row.by} />}
          <small>{moveCount(row.text)} moves</small>
          {best && (
            <small className="best" title="Your fastest">
              {clock(best)}
            </small>
          )}
        </span>
      </button>
      <button className="mini" onClick={time} aria-label="Time this algorithm" title="Time it">
        <Icon name="timer" />
      </button>
      <Copy text={row.text} />
      {remove && (
        <button className="mini" onClick={remove} aria-label="Delete this algorithm" title="Delete">
          <Icon name="close" />
        </button>
      )}
    </div>
  )
}

function OwnAlg({ c, rot, onAdd }: { c: Case; rot: Turn; onAdd: (text: string) => void }) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  let verdict: { ok: boolean; say: React.ReactNode } | null = null
  const plain = normalize(text).replace(/\s+/g, ' ').trim()
  if (plain) {
    try {
      parse(plain)
      const n = need(c, plain, rot)
      verdict =
        n === null
          ? { ok: false, say: 'Doesn’t solve this case' }
          : { ok: true, say: n ? <>Solves it after <Auf turn={n} /></> : 'Solves it with no AUF' }
    } catch (e) {
      verdict = { ok: false, say: e instanceof NotationError ? e.message : 'Can’t read that' }
    }
  }

  if (!open)
    return (
      <button className="quiet add" onClick={() => setOpen(true)}>
        <Icon name="plus" size={14} /> Add your own
      </button>
    )
  const add = () => {
    if (!verdict?.ok) return
    onAdd(plain)
    setText('')
    setOpen(false)
  }
  return (
    <form
      className="own"
      onSubmit={(e) => {
        e.preventDefault()
        add()
      }}
    >
      <input
        ref={input}
        id="own-alg"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape') setOpen(false)
        }}
        placeholder="R U R' U R U2 R'"
        aria-label="Your algorithm"
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
      />
      <button className="btn" disabled={!verdict?.ok}>
        Add
      </button>
      <button type="button" className="mini" onClick={() => setOpen(false)} aria-label="Cancel">
        <Icon name="close" />
      </button>
      <p data-ok={verdict?.ok} aria-live="polite">
        {verdict?.say ?? 'It’s checked as you type'}
      </p>
    </form>
  )
}

function Algorithms({ c, entry, angles, active, setActive }: { c: Case; entry: Entry; angles: Angle[]; active: number; setActive: (i: number) => void }) {
  const { hand } = usePrefs()
  const [all, setAll] = useState(false)
  const drills = useDrills(c.id)
  const angle = angles[active]
  const { main, more } = offers(c, hand, angle.rot, entry)
  const now = chosen(c, angle, hand).text
  const hidden = more.some((r) => r.text === now) ? false : !all
  const choose = (text: string) => updateAngle(c.id, active, { alg: text })
  const list = hidden ? main : [...main, ...more]
  return (
    <section className="algs">
      <div className="algs__head">
        <h2>Algorithms</h2>
        {angles.length > 1 && (
          <Segmented label="Choose for" value={AB[active]} options={[['A', 'Angle A'], ['B', 'Angle B']] as const} onChange={(v) => setActive(v === 'A' ? 0 : 1)} />
        )}
        {deckById.get(c.deck)!.hands && <Segmented label="Hands" value={hand} options={hands} onChange={(v) => setPrefs({ hand: v })} />}
      </div>
      <div role="radiogroup" aria-label="Algorithm">
        {list.map((r) => (
          <AlgRow
            key={(r.own ? 'own ' : '') + r.text}
            row={r}
            on={r.text === now}
            best={drills[r.text]?.best}
            choose={() => choose(r.text)}
            time={() => drill(c.id, r.text)}
            remove={
              r.own
                ? () => {
                    updateEntry(c.id, {
                      own: entry.own!.filter((t) => t !== r.text),
                      angles: anglesOf(entry).map((a) => (a.alg === r.text ? { ...a, alg: null } : a)),
                    })
                    say({ text: 'Algorithm deleted', undo: () => updateEntry(c.id, { own: entry.own, angles: entry.angles }) }, 6000)
                  }
                : undefined
            }
          />
        ))}
      </div>
      <div className="algs__foot">
        {hidden && more.length > 0 && (
          <button className="quiet add" onClick={() => setAll(true)}>
            <Icon name="down" size={14} /> {more.length} more
          </button>
        )}
        <OwnAlg
          c={c}
          rot={angle.rot}
          onAdd={(text) => {
            const known = [...main, ...more].some((r) => r.text === text)
            updateEntry(c.id, {
              own: known ? entry.own : [...(entry.own ?? []), text],
              angles: anglesOf(entry).map((a, i) => (i === active ? { ...a, alg: text } : a)),
            })
          }}
        />
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ the page */

export function CasePage({ c, sub, set, deck }: { c: Case; sub: Subset; set: ZSet; deck: Deck }) {
  const entry = useEntry(c.id)
  const status = entry.s ?? 0
  const { hand } = usePrefs()
  const angles = anglesOf(entry)
  const [picked, setActive] = useState(0)
  const active = Math.min(picked, angles.length - 1)
  const near = deck.flat ? deck : sub
  const at = near.cases.indexOf(c)
  const before = near.cases[at - 1]?.id
  const after = near.cases[at + 1]?.id
  const onward = status === 2 ? nextUp(deck.id, c.id) : null
  const note = (
    <>
      <Note label="Notes" value={entry.note ?? ''} placeholder="Anything else about this case" onSave={(v) => updateEntry(c.id, { note: v })} />
      <Practised id={c.id} status={status} />
    </>
  )

  useEffect(() => touch(c.id), [c.id])

  // After marking it with the keyboard, the way on is already focused.
  const way = useRef<HTMLAnchorElement>(null)
  const was = useRef(status)
  useEffect(() => {
    if (status === 2 && was.current !== 2 && document.activeElement === document.body) way.current?.focus({ preventScroll: true })
    was.current = status
  }, [status])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || covered()) return
      const el = e.target as HTMLElement
      if (el.closest('input, textarea')) return
      const k = e.key.toLowerCase()
      if (k === 'arrowleft' && before) go(before)
      else if (k === 'arrowright' && after) go(after)
      else if (k === 'l') change(c.id, status === 2 ? 0 : 2)
      else if (k === 'n' && onward) go(onward)
      else if (k === 'u') {
        playTurn()
        updateAngle(c.id, active, { rot: ((angles[active].rot + (e.shiftKey ? 3 : 1)) % 4) as Turn })
      } else if (k === 's') drill(c.id, chosen(c, angles[active], hand).text)
      else if (k === 'escape') go(sub.id)
      else return
      e.preventDefault()
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  })

  return (
    <main className="case" data-case={c.id} data-s={status} {...shade(sub)}>
      <div className="crumbs">
        <nav aria-label="You are here">
          <a href={`#${deck.flat ? homeOf(deck.id) : set.id}`}>{deck.flat ? deck.id : set.name}</a>
          <a href={`#${sub.id}`}>{deck.flat ? sub.name : subLine(sub)}</a>
        </nav>
        <div className="crumbs__step">
          <a className="tool" href={`#${before ?? c.id}`} aria-disabled={!before} aria-label="Previous case" title="Previous  ←">
            <Icon name="left" />
          </a>
          <a className="tool" href={`#${after ?? c.id}`} aria-disabled={!after} aria-label="Next case" title="Next  →">
            <Icon name="right" />
          </a>
        </div>
      </div>
      <Steps subs={deck.flat ? deck.subs : [sub]} current={c.id} />

      <div className="case__head">
        <h1>{c.name}</h1>
        <div className="case__actions">
          {status === 2 ? (
            <>
              <button className="btn btn--done" onClick={() => change(c.id, 0)} title="Take it back  L">
                <Icon name="check" /> Learned{entry.at ? <span>{date(entry.at)}</span> : null}
              </button>
              {onward && (
                <a ref={way} className="btn btn--main" href={`#${onward}`} title="Next unlearned case  N">
                  Next up {caseById.get(onward)!.name} <Icon name="right" />
                </a>
              )}
            </>
          ) : (
            <>
              <button className="btn" aria-pressed={status === 1} onClick={() => change(c.id, status === 1 ? 0 : 1)}>
                <i className="cell" data-s="1" /> Learning
              </button>
              <button className="btn btn--main btn--learn" onClick={() => learn(c.id)} title="Mark as learned  L">
                Mark as learned
              </button>
            </>
          )}
        </div>
      </div>

      <div className={angles.length > 1 ? 'angles angles--two' : 'angles'}>
        {angles.map((a, i) => (
          <AngleView key={i} c={c} angle={a} i={i} of={angles.length} active={i === active} onFocus={() => setActive(i)}>
            {angles.length < 2 && (
              <>
                {note}
                <button
                  className="quiet add"
                  onClick={(e) => {
                    e.stopPropagation()
                    addAngle(c.id, suggestAngle(c, angles[0], hand, entry.own))
                    setActive(1)
                  }}
                >
                  <Icon name="plus" size={14} /> Recognize it from a second angle
                </button>
              </>
            )}
          </AngleView>
        ))}
      </div>
      {angles.length > 1 && <div className="notes notes--wide">{note}</div>}
      <Algorithms c={c} entry={entry} angles={angles} active={active} setActive={setActive} />
    </main>
  )
}
