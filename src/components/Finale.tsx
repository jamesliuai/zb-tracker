import { useEffect, useRef } from 'react'
import { deckById, setById, type DeckId, type ZSet } from '../data/index.ts'
import { shade } from '../lib/text.ts'
import { finale } from '../reward/signals.ts'
import { getData } from '../state/store.ts'

const day = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

function span(list: ZSet[]): string | null {
  const when = list.flatMap((s) => s.cases.map((c) => getData().cases[c.id]?.at ?? 0)).filter(Boolean)
  if (!when.length) return null
  const [a, b] = [day(Math.min(...when)), day(Math.max(...when))]
  return a === b ? a : `${a} to ${b}`
}

/** A whole set or deck is learned. Its wall lights up across the page. */
export function Finale() {
  const id = finale.use()
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!id) return
    button.current?.focus({ preventScroll: true })
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finale.set(null)
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [id])
  if (!id) return null

  const deck = deckById.get(id as DeckId)
  const list = deck ? deck.sets : [setById.get(id)!]
  const count = list.reduce((n, s) => n + s.cases.length, 0)
  const when = span(list)
  return (
    <div className={deck && !deck.flat ? 'finale finale--all' : 'finale'} data-set={deck ? undefined : id} role="dialog" aria-modal="true" aria-label={deck ? `All of ${deck.id} learned` : `${list[0].name} learned`}>
      {deck?.flat && (
        <div className="finale__grid" aria-hidden="true">
          {deck.subs.flatMap((sub) => sub.cases.map((k) => ({ sub, k }))).map(({ sub, k }, i) => {
            const look = shade(sub)
            return <i className="cell" key={k.id} {...look} style={{ ...look.style, '--i': (i % 7) + Math.floor(i / 7) } as React.CSSProperties} />
          })}
        </div>
      )}
      <div className="finale__wall" aria-hidden="true" hidden={deck?.flat}>
        {list.map((s, si) => (
          <div className="finale__block" key={s.id} data-set={s.id}>
            {s.subs.map((sub, c) => (
              <div key={sub.id} {...shade(sub)}>
                {sub.cases.map((k, r) => (
                  <i className="cell" key={k.id} style={{ '--i': c + r + si * 5 } as React.CSSProperties} />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      <h2>{deck ? `Full ${deck.id}` : list[0].name}</h2>
      <p>
        All {count} cases learned.
        {when && (
          <>
            <br />
            {when}
          </>
        )}
      </p>
      <button ref={button} className="btn btn--main" onClick={() => finale.set(null)}>
        Continue
      </button>
    </div>
  )
}
