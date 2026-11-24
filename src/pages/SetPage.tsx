import { Glyph } from '../components/Cube.tsx'
import { Icon } from '../components/Icon.tsx'
import { Roll } from '../components/Roll.tsx'
import { Tile, tileKeys } from '../components/Tile.tsx'
import type { Subset, ZSet } from '../data/index.ts'
import { airy, shade } from '../lib/text.ts'
import { ripple } from '../reward/signals.ts'
import { useStats } from '../state/store.ts'

/** One bar per subset. On a subset's own page they carry names and work as tabs. */
export function Subnav({ set, sub }: { set: ZSet; sub?: Subset }) {
  const stats = useStats()
  return (
    <nav className={sub ? 'subnav' : 'subnav subnav--bars'} aria-label={`${set.name} subsets`}>
      {set.subs.map((s) => {
        const k = stats.bySub.get(s.id)!
        return (
          <a key={s.id} {...shade(s)} href={`#${s.id}`} aria-current={sub?.id === s.id ? 'page' : undefined} title={sub ? undefined : `${s.id} ${airy(s.name)}, ${k} of ${s.cases.length}`}>
            <i>
              <b style={{ scale: `${k / s.cases.length} 1` }} />
            </i>
            <span>
              {s.id}
              <em>{airy(s.name)}</em>
            </span>
          </a>
        )
      })}
    </nav>
  )
}

function Row({ sub }: { sub: Subset }) {
  const n = useStats().bySub.get(sub.id)!
  const waving = ripple.use() === sub.id
  return (
    <section className={waving ? 'row is-waving' : 'row'} aria-label={`${sub.id} ${airy(sub.name)}`}>
      <a className="row__head" href={`#${sub.id}`}>
        <b>{sub.id}</b>
        <span>{airy(sub.name)}</span>
        <span className="num">
          <Roll value={n} />
          <i>/{sub.cases.length}</i>
        </span>
        <Icon name="right" size={14} />
      </a>
      <div className="row__tiles">
        {sub.cases.map((c, i) => (
          <Tile key={c.id} c={c} i={i} />
        ))}
      </div>
    </section>
  )
}

/** The whole set at once. Each row is a COLL, and only the edges change along it. */
export function SetPage({ set }: { set: ZSet }) {
  const n = useStats().bySet.get(set.id)!
  return (
    <main className="set" data-set={set.id}>
      <div className="sethead">
        <Glyph ll={set.cases[0].ll} />
        <h1>{set.name}</h1>
        <p className="sethead__n">
          <Roll value={n} />
          <i> of {set.cases.length}</i>
        </p>
      </div>
      <Subnav set={set} />
      <div className="matrix" onKeyDown={tileKeys}>
        {set.subs.map((s) => (
          <Row key={s.id} sub={s} />
        ))}
      </div>
    </main>
  )
}
