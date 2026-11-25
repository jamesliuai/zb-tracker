import { useRef } from 'react'
import { caseById, subById, type Deck, type DeckId } from '../data/index.ts'
import { Alg, Auf } from '../components/Alg.tsx'
import { Cube } from '../components/Cube.tsx'
import { Icon } from '../components/Icon.tsx'
import { Roll } from '../components/Roll.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Tile, tileKeys } from '../components/Tile.tsx'
import { Wall } from '../components/Wall.tsx'
import { airy, shade } from '../lib/text.ts'
import { inFlight } from '../reward/signals.ts'
import { anglesOf, getEntry, nextUp, statusOf, useCases, useLast, usePrefs, useStats, type Stats } from '../state/store.ts'
import { chosen } from '../state/choose.ts'

const credits: Record<DeckId, React.ReactNode> = {
  ZBLL: 'Algorithms compiled by Juliette Sébastien, sheet layout by Thibaud Ou.',
  PLL: (
    <>
      The main algorithms are Yiheng Wang’s, from{' '}
      <a href="https://www.youtube.com/watch?v=vSOp5nAudys" target="_blank" rel="noreferrer">
        a video by CubeMaster
      </a>
      . The others are from{' '}
      <a href="https://speedcube.quest/algorithms/3x3/pll" target="_blank" rel="noreferrer">
        SpeedcubeQuest
      </a>
      .
    </>
  ),
}

function pace({ flat, cases }: Deck, { learned, today, week, pace }: Stats): string {
  const of = cases.length
  if (!learned && flat) return 'Every case, with the algorithm Yiheng Wang uses. Learn one and it lights up. Already know some? Check them off.'
  if (!learned) return 'Every square below is a case. Learn one and it lights up. Already know some? Open a set and check them off.'
  if (learned === of) return 'That’s all of it.'
  const bits = [week ? (today && today !== week ? `${today} today, ${week} this week.` : `${week} ${today ? 'today' : 'this week'}.`) : 'None in the last week.']
  if (pace >= 1) {
    const when = new Date(Date.now() + ((of - learned) / pace) * 7 * 86_400_000)
    if (when.getTime() - Date.now() < 5 * 365 * 86_400_000) bits.push(`At this pace you finish in ${when.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.`)
  }
  return bits.join(' ')
}

function UpNext({ deck }: { deck: Deck }) {
  useCases()
  const { hand } = usePrefs()
  const last = useLast(deck.id)
  const id = last && statusOf(last) !== 2 ? last : nextUp(deck.id, last)
  if (!id) return null
  const c = caseById.get(id)!
  const angle = anglesOf(getEntry(id))[0]
  const pick = chosen(c, angle, hand)
  const sub = subById.get(c.sub)!
  return (
    <a className="next" href={`#${id}`} data-case={id} {...shade(sub)}>
      <Cube key={id} ll={c.ll} rot={angle.rot} />
      <span className="next__text">
        <small>Up next</small>
        <b>{c.name}</b>
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

/** The cases being learned. Anything finished from here stays, lit, until you leave the page. */
function Shelf({ deck }: { deck: Deck }) {
  const { learning } = useStats(deck.id)
  const entries = useCases()
  const seen = useRef(new Set<string>())
  learning.forEach((id) => seen.current.add(id))
  const shelf = deck.cases.filter((c) => seen.current.has(c.id) && entries[c.id]?.s)
  if (!shelf.length) return null
  return (
    <section className="shelf">
      <h2>
        Learning now <span className="num">{learning.length || ''}</span>
      </h2>
      <div className="shelf__tiles" onKeyDown={tileKeys}>
        {shelf.map((c, i) => (
          <Tile key={c.id} c={c} i={i} named />
        ))}
      </div>
    </section>
  )
}

export function Home({ deck }: { deck: Deck }) {
  const stats = useStats(deck.id)
  const of = deck.cases.length
  const shown = stats.learned - inFlight.use()
  return (
    <main className="home">
      <section className="hero">
        <div className="hero__count" data-counter>
          <h1>
            <Roll value={shown} />
            <span className="hero__of">
              of {of}
              <br />
              learned
            </span>
          </h1>
          <p>{pace(deck, stats)}</p>
        </div>
        <UpNext deck={deck} />
      </section>

      {deck.flat ? (
        <Sheet deck={deck} />
      ) : (
        <>
          <Wall deck={deck} />
          <Shelf deck={deck} />
        </>
      )}

      <footer className="foot">
        <p>
          {credits[deck.id]} All {of} cases and every algorithm here were checked by simulation. Your progress stays in this browser, so export it now and then.
        </p>
      </footer>
    </main>
  )
}
