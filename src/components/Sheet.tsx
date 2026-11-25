import type { Deck, ZSet } from '../data/index.ts'
import { shade } from '../lib/text.ts'
import { ripple } from '../reward/signals.ts'
import { usePrefs, useStats } from '../state/store.ts'
import { KnowAll } from './KnowAll.tsx'
import { Line } from './Line.tsx'
import { Roll } from './Roll.tsx'
import { tileKeys } from './Tile.tsx'

function Part({ set }: { set: ZSet }) {
  const { hand } = usePrefs()
  const n = useStats(set.deck).bySet.get(set.id)!
  const waving = ripple.use() === set.id
  return (
    <section className="part" id={set.id} aria-label={set.name} {...shade(set.subs[0])}>
      <div className="part__head">
        <h2>{set.name}</h2>
        <span className="num">
          <Roll value={n} />
          <i>/{set.cases.length}</i>
        </span>
        <KnowAll sub={set.subs[0]} />
      </div>
      <div className={waving ? 'lines lines--cards is-waving' : 'lines lines--cards'}>
        {set.cases.map((c, i) => (
          <Line key={c.id} c={c} i={i} hand={hand} named />
        ))}
      </div>
    </section>
  )
}

/** A whole deck on one page, when it's small enough for that. */
export function Sheet({ deck }: { deck: Deck }) {
  return (
    <div className="sheet" onKeyDown={tileKeys}>
      {deck.sets.map((s) => (
        <Part key={s.id} set={s} />
      ))}
    </div>
  )
}
