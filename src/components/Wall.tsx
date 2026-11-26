import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { caseById, subById, type Deck, type ZSet } from '../data/index.ts'
import { go } from '../lib/router.ts'
import { shade, subWords } from '../lib/text.ts'
import { useStats, useStatus } from '../state/store.ts'
import { Cell } from './Cells.tsx'
import { Cube, Glyph } from './Cube.tsx'
import { Roll } from './Roll.tsx'

const words = ['Not started', 'Learning', 'Learned']
const fine = typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)')

interface Spot {
  id: string
  x: number
  y: number
  below: boolean
}

function Tip({ spot }: { spot: Spot }) {
  const c = caseById.get(spot.id)!
  const s = useStatus(c.id)
  return (
    <div className={spot.below ? 'tip tip--below' : 'tip'} data-set={c.set} style={{ left: spot.x, top: spot.y }} aria-hidden="true">
      <Cube ll={c.ll} />
      <b>{c.name}</b>
      <span>{subWords(subById.get(c.sub)!)}</span>
      <em data-s={s}>{words[s]}</em>
    </div>
  )
}

function Block({ set, short, onSpot }: { set: ZSet; short: boolean; onSpot: (s: Spot | null) => void }) {
  const n = useStats(set.deck).bySet.get(set.id)!
  const id = (e: React.PointerEvent | React.MouseEvent) => (e.target as HTMLElement).closest<HTMLElement>('.cell')?.dataset.id
  return (
    <section className={n === set.cases.length ? 'block is-full' : 'block'} data-set={set.id} style={{ '--cols': set.subs.length } as React.CSSProperties}>
      <a className="block__head" href={`#${set.id}`} title={short ? set.name : undefined}>
        <Glyph ll={set.cases[0].ll} />
        <b>{short ? set.short : set.name}</b>
        <span className="num">
          <Roll value={n} />
          <i>/{set.cases.length}</i>
        </span>
      </a>
      {/* The link above is the way in for keyboards and screen readers. These are extra. */}
      <div
        className="block__cells"
        aria-hidden="true"
        onClick={(e) => go((fine && fine.matches && id(e)) || set.id)}
        onPointerMove={(e) => {
          if (e.pointerType !== 'mouse') return
          const el = (e.target as HTMLElement).closest<HTMLElement>('.cell')
          if (!el) return onSpot(null)
          const b = el.getBoundingClientRect()
          onSpot({ id: el.dataset.id!, x: Math.min(innerWidth - 92, Math.max(92, b.x + b.width / 2)), y: b.y < 250 ? b.bottom : b.y, below: b.y < 250 })
        }}
        onPointerLeave={() => onSpot(null)}
      >
        {set.subs.map((sub, c) => (
          <div key={sub.id} {...shade(sub)}>
            {sub.cases.map((k, r) => (
              <Cell key={k.id} c={k} i={c + r} />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * How many columns the squares have to fit across, with how many sets: all of them in one row, or,
 * on a narrow screen, in two rows split where the wider row is as narrow as it can be.
 */
function fit({ sets }: Deck) {
  const cols = sets.map((s) => s.subs.length)
  const sum = (list: number[]) => list.reduce((a, b) => a + b, 0)
  let row = { cols: sum(cols), sets: sets.length }
  for (let at = 1; at < cols.length; at++) {
    const [a, b] = [sum(cols.slice(0, at)), sum(cols.slice(at))]
    const wider = a >= b ? { cols: a, sets: at } : { cols: b, sets: cols.length - at }
    if (at === 1 || wider.cols < row.cols) row = wider
  }
  return { '--all': sum(cols), '--sets': sets.length, '--row': row.cols, '--row-sets': row.sets } as React.CSSProperties
}

/** Every case of a deck as one square. Columns are subsets, and a square lights up when it's learned. */
export function Wall({ deck }: { deck: Deck }) {
  const [spot, setSpot] = useState<Spot | null>(null)
  const last = useRef('')
  const onSpot = (s: Spot | null) => {
    const k = s ? s.id : ''
    if (k === last.current) return
    last.current = k
    setSpot(s)
  }
  // a set's name has the width of a few squares above it, so long names give way to the tab's
  const short = deck.sets.some((s) => s.name.length > 8)
  return (
    <div className="wall" style={fit(deck)}>
      {deck.sets.map((s) => (
        <Block key={s.id} set={s} short={short} onSpot={onSpot} />
      ))}
      {/* in body, because a size container can trap fixed elements in some browsers */}
      {spot && createPortal(<Tip spot={spot} />, document.body)}
    </div>
  )
}
