import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { caseById, sets, subById, type ZSet } from '../data/index.ts'
import { go } from '../lib/router.ts'
import { airy, shade } from '../lib/text.ts'
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
      <b>{c.id}</b>
      <span>{airy(subById.get(c.sub)!.name)}</span>
      <em data-s={s}>{words[s]}</em>
    </div>
  )
}

function Block({ set, onSpot }: { set: ZSet; onSpot: (s: Spot | null) => void }) {
  const n = useStats().bySet.get(set.id)!
  const id = (e: React.PointerEvent | React.MouseEvent) => (e.target as HTMLElement).closest<HTMLElement>('.cell')?.dataset.id
  return (
    <section className={n === set.cases.length ? 'block is-full' : 'block'} data-set={set.id} style={{ '--cols': set.subs.length } as React.CSSProperties}>
      <a className="block__head" href={`#${set.id}`}>
        <Glyph ll={set.cases[0].ll} />
        <b>{set.name}</b>
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

/** Every ZBLL case as one square. Columns are subsets, and a square lights up when it's learned. */
export function Wall() {
  const [spot, setSpot] = useState<Spot | null>(null)
  const last = useRef('')
  const onSpot = (s: Spot | null) => {
    const k = s ? s.id : ''
    if (k === last.current) return
    last.current = k
    setSpot(s)
  }
  return (
    <div className="wall">
      {sets.map((s) => (
        <Block key={s.id} set={s} onSpot={onSpot} />
      ))}
      {/* in body, because a size container can trap fixed elements in some browsers */}
      {spot && createPortal(<Tip spot={spot} />, document.body)}
    </div>
  )
}
