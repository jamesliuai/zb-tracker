import { useRef } from 'react'
import { TOTAL, caseById, cases, subById } from '../data/index.ts'
import { Alg, Auf } from '../components/Alg.tsx'
import { Cube } from '../components/Cube.tsx'
import { Icon } from '../components/Icon.tsx'
import { Roll } from '../components/Roll.tsx'
import { Tile, tileKeys } from '../components/Tile.tsx'
import { Wall } from '../components/Wall.tsx'
import { airy, shade } from '../lib/text.ts'
import { inFlight } from '../reward/signals.ts'
import { anglesOf, getEntry, nextUp, statusOf, useCases, useLast, usePrefs, useStats, type Stats } from '../state/store.ts'
import { chosen } from '../state/choose.ts'

function pace({ learned, today, week, pace }: Stats): string {
  if (!learned) return 'Every square below is a case. Learn one and it lights up. Already know some? Open a set and check them off.'
  if (learned === TOTAL) return 'That’s all of it.'
  const bits = [week ? (today && today !== week ? `${today} today, ${week} this week.` : `${week} ${today ? 'today' : 'this week'}.`) : 'None in the last week.']
  if (pace >= 1) {
    const when = new Date(Date.now() + ((TOTAL - learned) / pace) * 7 * 86_400_000)
    if (when.getTime() - Date.now() < 5 * 365 * 86_400_000) bits.push(`At this pace you finish in ${when.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.`)
  }
  return bits.join(' ')
}

function UpNext() {
  useCases()
  const { hand } = usePrefs()
  const last = useLast()
  const id = last && statusOf(last) !== 2 ? last : nextUp(last)
  if (!id) return null
  const c = caseById.get(id)!
  const angle = anglesOf(getEntry(id))[0]
  const pick = chosen(c, angle, hand)
  const sub = subById.get(c.sub)!
  return (
    <a className="next" href={`#${id}`} data-case={id} {...shade(sub)}>
      <Cube ll={c.ll} rot={angle.rot} />
      <span className="next__text">
        <small>Up next</small>
        <b>{id}</b>
        <i>{airy(sub.name)}</i>
        <span className="next__alg">
          <Auf turn={pick.need} />
          <Alg text={pick.text} />
        </span>
      </span>
      <Icon name="right" />
    </a>
  )
}

export function Home() {
  const stats = useStats()
  const shown = stats.learned - inFlight.use()
  const entries = useCases()
  // anything finished from the shelf stays on it, lit, until you leave the page
  const seen = useRef(new Set<string>())
  stats.learning.forEach((id) => seen.current.add(id))
  const shelf = cases.filter((c) => seen.current.has(c.id) && entries[c.id]?.s)
  return (
    <main className="home">
      <section className="hero">
        <div className="hero__count" data-counter>
          <h1>
            <Roll value={shown} />
            <span className="hero__of">
              of {TOTAL}
              <br />
              learned
            </span>
          </h1>
          <p>{pace(stats)}</p>
        </div>
        <UpNext />
      </section>

      <Wall />

      {shelf.length > 0 && (
        <section className="shelf">
          <h2>
            Learning now <span className="num">{stats.learning.length || ''}</span>
          </h2>
          <div className="shelf__tiles" onKeyDown={tileKeys}>
            {shelf.map((c, i) => (
              <Tile key={c.id} c={c} i={i} named />
            ))}
          </div>
        </section>
      )}

      <footer className="foot">
        <p>
          Algorithms compiled by Juliette Sébastien, sheet layout by Thibaud Ou. All {TOTAL} cases and every algorithm here were checked by simulation. Your progress stays in this browser, so export it now and then.
        </p>
      </footer>
    </main>
  )
}
