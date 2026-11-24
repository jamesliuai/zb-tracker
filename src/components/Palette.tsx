import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AUF, NotationError, examine, parse, solves } from '../cube/engine.ts'
import { caseByKey, caseById, setById, sets, subById, subsets, type Case } from '../data/index.ts'
import { go } from '../lib/router.ts'
import { useStatus } from '../state/store.ts'
import { Cube, Glyph } from './Cube.tsx'
import { Icon } from './Icon.tsx'

interface Hit {
  id: string
  title: string
  detail: string
  ll: string
  set: string
  isCase?: boolean
}

const setWords: Record<string, string> = { t: 'T', u: 'U', l: 'L', h: 'H', pi: 'Pi', p: 'Pi', s: 'S', sune: 'S', as: 'AS', a: 'AS', anti: 'AS', antisune: 'AS' }

const subName = (c: Case) => subById.get(c.sub)!.name
const hitSet = (id: string): Hit => {
  const s = setById.get(id)!
  return { id, title: s.name, detail: `${s.cases.length} cases`, ll: s.cases[0].ll, set: id }
}
const hitSub = (id: string): Hit => {
  const s = subById.get(id)!
  return { id, title: id, detail: s.name, ll: s.cases[0].ll, set: s.set, isCase: true }
}
const hitCase = (c: Case, detail = subName(c)): Hit => ({ id: c.id, title: c.id, detail, ll: c.ll, set: c.set, isCase: true })

function search(text: string): { hits: Hit[]; message?: string } {
  const q = text.trim()
  if (!q) return { hits: sets.map((s) => hitSet(s.id)) }

  const m = /^([a-z]+)\s*(\d)?(?:[\s\-./]+|(?<=\d))?(\d{1,2})?$/i.exec(q)
  const set = m && setWords[m[1].toLowerCase()]
  if (m && set) {
    const [, , a, b] = m
    if (a && b) {
      const c = caseById.get(`${set}${a}-${b}`)
      if (c) return { hits: [hitCase(c)] }
    } else if (a) {
      const sub = subById.get(`${set}${a}`)
      if (sub) return { hits: [hitSub(sub.id), ...sub.cases.map((c) => hitCase(c))] }
    } else return { hits: [hitSet(set), ...setById.get(set)!.subs.map((s) => hitSub(s.id))] }
  }

  const named = subsets.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()))
  if (named.length) return { hits: named.map((s) => hitSub(s.id)) }

  // anything else is read as an algorithm
  try {
    const moves = parse(q)
    if (moves.length < 4) return { hits: [], message: 'Keep typing to look up an algorithm' }
    const v = examine(q)
    if (v.kind === 'layer') {
      const c = caseByKey.get(v.key)
      if (c) {
        const auf = AUF[solves(q, c.ll)[0] ?? 0]
        return { hits: [hitCase(c, `This solves ${c.id}${auf ? `, after ${auf.replace("'", '′')}` : ''}`)] }
      }
      return { hits: [], message: 'This solves the last layer, but the case isn’t a ZBLL. It’s a PLL, or the edges are flipped.' }
    }
    if (v.kind === 'does-nothing') return { hits: [], message: 'This only turns the top layer' }
    return { hits: [], message: 'This doesn’t keep the first two layers solved' }
  } catch (e) {
    const near = e instanceof NotationError && /[UDRLFB]/.test(q) && q.length > 6 ? ` ${e.message}.` : ''
    return { hits: [], message: `Nothing matches.${near} Try “T3”, “Pi 2-5”, “Niklas”, or paste an algorithm.` }
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
      {hit.isCase ? <Cube ll={hit.ll} /> : <Glyph ll={hit.ll} />}
      <b>{hit.title}</b>
      <span>{hit.detail}</span>
      {s === 2 && <Icon name="check" />}
    </button>
  )
}

function Search({ done }: { done: () => void }) {
  const [text, setText] = useState('')
  const [at, setAt] = useState(0)
  const { hits, message } = useMemo(() => search(text), [text])
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
export function Palette({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      {open && <Search done={onClose} />}
    </dialog>
  )
}
