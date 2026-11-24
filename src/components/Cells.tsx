import { memo } from 'react'
import { useStatus } from '../state/store.ts'
import type { Case, Subset } from '../data/index.ts'
import { ripple } from '../reward/signals.ts'

const words = ['not started', 'learning', 'learned']

export const Cell = memo(function Cell({ c, i = 0 }: { c: Case; i?: number }) {
  return <i className="cell" data-s={useStatus(c.id)} data-id={c.id} style={{ '--i': i } as React.CSSProperties} />
})

function Step({ c, i, current }: { c: Case; i: number; current: boolean }) {
  const s = useStatus(c.id)
  return (
    <a href={`#${c.id}`} aria-label={`${c.id}, ${words[s]}`} aria-current={current ? 'page' : undefined} style={{ '--i': i } as React.CSSProperties}>
      <i className="cell" data-s={s} />
      <span>{c.n}</span>
    </a>
  )
}

/** The cases of a subset in a row, to see where you are and step between them. */
export function Steps({ sub, current }: { sub: Subset; current?: string }) {
  const waving = ripple.use() === sub.id
  return (
    <nav className={waving ? 'steps is-waving' : 'steps'} aria-label={`Cases in ${sub.id}`}>
      {sub.cases.map((c, i) => (
        <Step key={c.id} c={c} i={i} current={c.id === current} />
      ))}
    </nav>
  )
}
