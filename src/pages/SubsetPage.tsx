import { memo, useState } from 'react'
import { Alg, Auf } from '../components/Alg.tsx'
import { Cube } from '../components/Cube.tsx'
import { Icon } from '../components/Icon.tsx'
import { Roll } from '../components/Roll.tsx'
import { Check, tileKeys } from '../components/Tile.tsx'
import type { Case, Hand, Subset, ZSet } from '../data/index.ts'
import { airy, shade } from '../lib/text.ts'
import { learnMany } from '../reward/celebrate.ts'
import { ripple } from '../reward/signals.ts'
import { chosen } from '../state/choose.ts'
import { anglesOf, useEntry, usePrefs, useStats } from '../state/store.ts'
import { Subnav } from './SetPage.tsx'

const words = ['not started', 'learning', 'learned']

const Line = memo(function Line({ c, i, hand }: { c: Case; i: number; hand: Hand }) {
  const e = useEntry(c.id)
  const angles = anglesOf(e)
  const s = e.s ?? 0
  return (
    <article className="line" data-case={c.id} data-s={s} style={{ '--i': i } as React.CSSProperties}>
      <a className="line__link" href={`#${c.id}`} aria-label={`${c.id}, ${words[s]}`}>
        <Cube ll={c.ll} rot={angles[0].rot} />
        <span className="line__n">{c.n}</span>
      </a>
      <div className="line__angles">
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

/** One COLL, its twelve cases with their algorithms and notes. */
export function SubsetPage({ set, sub }: { set: ZSet; sub: Subset }) {
  const { hand } = usePrefs()
  const n = useStats().bySub.get(sub.id)!
  const waving = ripple.use() === sub.id
  const left = sub.cases.length - n
  const [marking, setMarking] = useState(false)
  const before = set.subs[sub.n - 2]?.id
  const after = set.subs[sub.n]?.id
  return (
    <main className="set" {...shade(sub)}>
      <div className="crumbs">
        <nav aria-label="You are here">
          <a href={`#${set.id}`}>{set.name}</a>
          <a href={`#${sub.id}`}>{sub.id}</a>
        </nav>
        <div className="crumbs__step">
          <a className="tool" href={`#${before ?? sub.id}`} aria-disabled={!before} aria-label="Previous subset">
            <Icon name="left" />
          </a>
          <a className="tool" href={`#${after ?? sub.id}`} aria-disabled={!after} aria-label="Next subset">
            <Icon name="right" />
          </a>
        </div>
      </div>
      <Subnav set={set} sub={sub} />
      <div className="subhead">
        <h1>
          {sub.id} <span>{airy(sub.name)}</span>
        </h1>
        <p className="sethead__n">
          <Roll value={n} />
          <i> of {sub.cases.length}</i>
        </p>
        {left > 0 && !marking && (
          <button
            className="quiet"
            onClick={() => {
              setMarking(true)
              setTimeout(() => setMarking(false), 1400)
              learnMany(sub.cases.map((c) => c.id))
            }}
          >
            {left === sub.cases.length ? `Already know all ${left}?` : `Mark the other ${left} as learned`}
          </button>
        )}
      </div>
      <div className={waving ? 'lines is-waving' : 'lines'} onKeyDown={tileKeys}>
        {sub.cases.map((c, i) => (
          <Line key={c.id} c={c} i={i} hand={hand} />
        ))}
      </div>
    </main>
  )
}
