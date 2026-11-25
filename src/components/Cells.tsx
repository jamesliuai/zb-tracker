import { memo } from 'react'
import type { Case, Subset } from '../data/index.ts'
import { shade } from '../lib/text.ts'
import { ripple } from '../reward/signals.ts'
import { useStatus } from '../state/store.ts'

const words = ['not started', 'learning', 'learned']

export const Cell = memo(function Cell({ c, i = 0 }: { c: Case; i?: number }) {
  return <i className="cell" data-s={useStatus(c.id)} data-id={c.id} style={{ '--i': i } as React.CSSProperties} />
})

function Step({ c, i, current }: { c: Case; i: number; current: boolean }) {
  const s = useStatus(c.id)
  return (
    <a href={`#${c.id}`} aria-label={`${c.name}, ${words[s]}`} aria-current={current ? 'page' : undefined} style={{ '--i': i } as React.CSSProperties}>
      <i className="cell" data-s={s} />
      <span>{c.short}</span>
    </a>
  )
}

function Run({ sub, current }: { sub: Subset; current: string }) {
  const waving = ripple.use() === sub.id
  const look = shade(sub)
  return (
    <div className={waving ? 'steps__run is-waving' : 'steps__run'} {...look} style={{ ...look.style, '--of': sub.cases.length } as React.CSSProperties}>
      {sub.cases.map((c, i) => (
        <Step key={c.id} c={c} i={i} current={c.id === current} />
      ))}
    </div>
  )
}

/** Cases in a row, to see where you are and step between them. */
export function Steps({ subs, current }: { subs: Subset[]; current: string }) {
  return (
    <nav className="steps" aria-label="Cases nearby">
      {subs.map((s) => (
        <Run key={s.id} sub={s} current={current} />
      ))}
    </nav>
  )
}
