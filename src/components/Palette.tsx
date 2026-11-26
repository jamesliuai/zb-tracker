import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AUF, NotationError, examine, parse, solves } from '../cube/engine.ts'
import { caseByKey, caseById, deckById, decks, setById, subById, subsets, type Case, type Deck, type Subset, type ZSet } from '../data/index.ts'
import { go, homeOf, trainOf } from '../lib/router.ts'
import { useStatus } from '../state/store.ts'
import { Cube, Glyph } from './Cube.tsx'
import { Icon, type IconName } from './Icon.tsx'

interface Hit {
  id: string
  title: string
  detail: string
  ll: string
  set?: string
  isCase?: boolean
  icon?: IconName
}

const setWords: Record<string, string> = { t: 'T', u: 'U', l: 'L', h: 'H', pi: 'Pi', p: 'Pi', s: 'S', sune: 'S', as: 'AS', a: 'AS', anti: 'AS', antisune: 'AS' }

const hitDeck = (d: Deck): Hit => ({ id: homeOf(d.id), title: d.id, detail: `${d.cases.length} cases`, ll: d.cases[0].ll })
const hitTrain = (d: Deck): Hit => ({ id: trainOf(d.id), title: 'Train', detail: `${d.id}, against the clock`, ll: d.cases[0].ll, icon: 'timer' })
const training = (q: string) => q.length >= 3 && ['train', 'practice', 'drill', 'timer'].some((w) => w.startsWith(q.toLowerCase()))
const hitSet = (s: ZSet): Hit => ({ id: s.id, title: s.name, detail: `${s.cases.length} cases`, ll: s.cases[0].ll, set: s.id })
const hitSub = (s: Subset): Hit => ({ id: s.id, title: s.id, detail: s.name, ll: s.cases[0].ll, set: s.set, isCase: true })
const hitCase = (c: Case, detail = subById.get(c.sub)!.name): Hit => ({ id: c.id, title: c.name, detail, ll: c.ll, set: c.set, isCase: true })

/** T, T3, T3-5 and the names of subsets. */
function inZbll(q: string): Hit[] {
  const m = /^([a-z]+)\s*(\d)?(?:[\s\-./]+|(?<=\d))?(\d{1,2})?$/i.exec(q)
  const set = m && setById.get(setWords[m[1].toLowerCase()])
  if (set) {
    const [, , a, b] = m
    const sub = subById.get(`${set.id}${a}`)
    if (!a && !b) return [hitSet(set), ...set.subs.map(hitSub)]
    const c = sub && b ? caseById.get(`${sub.id}-${b}`) : undefined
    if (c) return [hitCase(c)]
    if (sub && !b) return [hitSub(sub), ...sub.cases.map((x) => hitCase(x))]
  }
  return subsets.filter((s) => s.deck === 'ZBLL' && s.name.toLowerCase().includes(q.toLowerCase())).map(hitSub)
}

/** Ja, J perm, and the names of the groups. */
function inPll(q: string): Hit[] {
  const pll = deckById.get('PLL')!
  const name = q
    .toLowerCase()
    .replace(/\bpll\b|[\s-]*perms?$/g, ' ')
    .trim()
  if (!name) return [hitDeck(pll)]
  const found = pll.cases.filter((c) => (name.length < 3 ? c.short.toLowerCase().startsWith(name) : subById.get(c.sub)!.name.toLowerCase().includes(name)))
  return found.map((c) => hitCase(c))
}

function search(text: string, deck: Deck): { hits: Hit[]; message?: string } {
  const q = text.trim()
  const here = deck.flat ? deck.cases.map((c) => hitCase(c)) : deck.sets.map(hitSet)
  if (!q) return { hits: [...here, hitTrain(deck), ...decks.filter((d) => d !== deck).map(hitDeck)] }
  if (training(q)) return { hits: [hitTrain(deck), ...decks.filter((d) => d !== deck).map(hitTrain)] }

  const named = deck.id === 'PLL' ? [...inPll(q), ...inZbll(q)] : [...inZbll(q), ...inPll(q)]
  if (named.length) return { hits: named }
  const other = decks.find((d) => d.id.toLowerCase() === q.toLowerCase())
  if (other) return { hits: [hitDeck(other)] }

  // anything else is read as an algorithm
  try {
    const moves = parse(q)
    if (moves.length < 4) return { hits: [], message: 'Keep typing to look up an algorithm' }
    const v = examine(q)
    if (v.kind === 'layer') {
      const c = caseByKey.get(v.key)
      if (c) {
        const auf = AUF[solves(q, c.ll)[0] ?? 0]
        return { hits: [hitCase(c, `This solves ${c.name}${auf ? `, after ${auf.replace("'", '′')}` : ''}`)] }
      }
      return { hits: [], message: 'This solves the last layer, but with edges to flip, so it’s neither a ZBLL nor a PLL.' }
    }
    if (v.kind === 'does-nothing') return { hits: [], message: 'This only turns the top layer' }
    return { hits: [], message: 'This doesn’t keep the first two layers solved' }
  } catch (e) {
    const near = e instanceof NotationError && /[UDRLFB]/.test(q) && q.length > 6 ? ` ${e.message}.` : ''
    const names = deck.id === 'PLL' ? '“Ua”, “J perm”, “diagonal”' : '“T3”, “Pi 2-5”, “Niklas”'
    return { hits: [], message: `Nothing matches.${near} Try ${names}, or paste an algorithm.` }
  }
}

function Result({ hit, on, pick, hover }: { hit: Hit; on: boolean; pick: () => void; hover: () => void }) {
  const s = useStatus(hit.id)
  const el = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (on) el.current?.scrollIntoView({ block: 'nearest' })
  }, [on])
  return (
    <button ref={el} className="hit" role="option" aria-selected={on} data-set={hit.set} onClick={pick} onPointerMove={hover} tabIndex={-1}>
      {hit.icon ? <span className="hit__icon"><Icon name={hit.icon} size={20} /></span> : hit.isCase ? <Cube ll={hit.ll} /> : <Glyph ll={hit.ll} />}
      <b>{hit.title}</b>
      <span>{hit.detail}</span>
      {s === 2 && <Icon name="check" />}
    </button>
  )
}

function Search({ deck, done }: { deck: Deck; done: () => void }) {
  const [text, setText] = useState('')
  const [at, setAt] = useState(0)
  const { hits, message } = useMemo(() => search(text, deck), [text, deck])
  const pick = (h: Hit) => {
    done()
    go(h.id)
  }
  return (
    <div
      className="palette__in"
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault()
          setAt((i) => (hits.length ? (i + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length : 0))
        } else if (e.key === 'Enter' && hits[at]) {
          e.preventDefault()
          pick(hits[at])
        }
      }}
    >
      <div className="palette__field">
        <Icon name="search" size={18} />
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setAt(0)
          }}
          placeholder="Find a case, or paste an algorithm"
          aria-label="Find a case, or paste an algorithm"
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
        />
        <kbd>esc</kbd>
      </div>
      {hits.length > 0 && (
        <div className="palette__hits" role="listbox" aria-label="Results">
          {hits.map((h, i) => (
            <Result key={h.id} hit={h} on={i === at} pick={() => pick(h)} hover={() => setAt(i)} />
          ))}
        </div>
      )}
      {message && <p className="palette__msg">{message}</p>}
    </div>
  )
}

/** Opens before the key that asked for it has finished, so nothing typed after it can go astray. */
export function Palette({ open, deck, onClose }: { open: boolean; deck: Deck; onClose: () => void }) {
  const box = useRef<HTMLDialogElement>(null)

  useLayoutEffect(() => {
    const d = box.current!
    if (open && !d.open) d.showModal()
    else if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={box}
      className="palette"
      aria-label="Search"
      // the event arrives late, so make sure it isn't about an earlier opening
      onClose={() => !box.current?.open && onClose()}
      onClick={(e) => e.target === box.current && onClose()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {open && <Search deck={deck} done={onClose} />}
    </dialog>
  )
}
