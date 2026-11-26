import { Icon } from '../components/Icon.tsx'
import { KnowAll } from '../components/KnowAll.tsx'
import { Line } from '../components/Line.tsx'
import { Roll } from '../components/Roll.tsx'
import { tileKeys } from '../components/Tile.tsx'
import { TrainThese } from '../components/TrainThese.tsx'
import type { Subset, ZSet } from '../data/index.ts'
import { airy, shade, subName } from '../lib/text.ts'
import { ripple } from '../reward/signals.ts'
import { usePrefs, useStats } from '../state/store.ts'
import { Subnav } from './SetPage.tsx'

/** One COLL, its twelve cases with their algorithms and notes. */
export function SubsetPage({ set, sub }: { set: ZSet; sub: Subset }) {
  const { hand } = usePrefs()
  const n = useStats(sub.deck).bySub.get(sub.id)!
  const waving = ripple.use() === sub.id
  const before = set.subs[sub.n - 2]?.id
  const after = set.subs[sub.n]?.id
  return (
    <main className="set" {...shade(sub)}>
      <div className="crumbs">
        <nav aria-label="You are here">
          <a href={`#${set.id}`}>{set.name}</a>
          <a href={`#${sub.id}`}>{sub.short}</a>
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
          {subName(sub)} <span>{airy(sub.name)}</span>
        </h1>
        <p className="sethead__n">
          <Roll value={n} />
          <i> of {sub.cases.length}</i>
        </p>
        <div className="subhead__do">
          <KnowAll sub={sub} />
          <TrainThese sub={sub} />
        </div>
      </div>
      <div className={waving ? 'lines is-waving' : 'lines'} onKeyDown={tileKeys}>
        {sub.cases.map((c, i) => (
          <Line key={c.id} c={c} i={i} hand={hand} />
        ))}
      </div>
    </main>
  )
}
