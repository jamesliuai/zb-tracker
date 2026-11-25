import { memo } from 'react'
import type { Case, Hand } from '../data/index.ts'
import { chosen } from '../state/choose.ts'
import { anglesOf, useEntry } from '../state/store.ts'
import { Alg, Auf } from './Alg.tsx'
import { Cube } from './Cube.tsx'
import { Check } from './Tile.tsx'

const words = ['not started', 'learning', 'learned']

/** A case with the algorithms and notes for it. */
export const Line = memo(function Line({ c, i, hand, named = false }: { c: Case; i: number; hand: Hand; named?: boolean }) {
  const e = useEntry(c.id)
  const angles = anglesOf(e)
  const s = e.s ?? 0
  return (
    <article className="line" data-case={c.id} data-s={s} style={{ '--i': i } as React.CSSProperties}>
      <a className="line__link" href={`#${c.id}`} aria-label={`${c.name}, ${words[s]}`}>
        <Cube ll={c.ll} rot={angles[0].rot} />
        {!named && <span className="line__n">{c.short}</span>}
      </a>
      <div className="line__angles">
        {named && <b className="line__name">{c.short}</b>}
        {angles.map((a, k) => {
          const pick = chosen(c, a, hand)
          return (
            <div className="line__angle" key={k}>
              {angles.length > 1 && k > 0 && <Cube ll={c.ll} rot={a.rot} />}
              <div>
                <p className="line__alg">
                  <Auf turn={pick.need} />
                  <Alg text={pick.text} />
                </p>
                {a.rec && <p className="line__note">{a.rec}</p>}
                {a.auf && (
                  <p className="line__note">
                    <b>AUF</b> {a.auf}
                  </p>
                )}
              </div>
            </div>
          )
        })}
        {e.note && <p className="line__note line__note--wide">{e.note}</p>}
      </div>
      <Check id={c.id} />
    </article>
  )
})
