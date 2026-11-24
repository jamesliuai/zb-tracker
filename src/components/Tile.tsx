import { memo } from 'react'
import { subById, type Case } from '../data/index.ts'
import { shade } from '../lib/text.ts'
import { change } from '../reward/celebrate.ts'
import { useStatus } from '../state/store.ts'
import { Cube } from './Cube.tsx'
import { Icon } from './Icon.tsx'

const words = ['not started', 'learning', 'learned']

/** The round check on a case. Pressing it is the quick way to mark it. */
export function Check({ id, className = '' }: { id: string; className?: string }) {
  const s = useStatus(id)
  return (
    <button
      className={`check ${className}`}
      aria-pressed={s === 2}
      aria-label={s === 2 ? `${id} is learned. Take it back` : `Mark ${id} as learned`}
      title={s === 2 ? 'Learned' : 'Mark as learned'}
      data-s={s}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        change(id, s === 2 ? 0 : 2, 'quick')
      }}
    >
      <Icon name="check" size={14} />
    </button>
  )
}

export const Tile = memo(function Tile({ c, i, named = false }: { c: Case; i: number; named?: boolean }) {
  const s = useStatus(c.id)
  const look = shade(subById.get(c.sub)!)
  return (
    <div className="tile" data-case={c.id} data-s={s} {...look} style={{ ...look.style, '--i': i } as React.CSSProperties}>
      <a className="tile__link" href={`#${c.id}`} aria-label={`${c.id}, ${words[s]}`}>
        <Cube ll={c.ll} />
        <span className="tile__n">{named ? c.id : c.n}</span>
      </a>
      <Check id={c.id} className="tile__check" />
    </div>
  )
})

/** Arrow keys move between the tiles of a grid, whatever its width. L marks the focused one. */
export function tileKeys(e: React.KeyboardEvent<HTMLElement>) {
  const here = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-case]')
  if (!here || e.metaKey || e.ctrlKey || e.altKey) return
  if (e.key === 'l' || e.key === 'L') {
    e.preventDefault()
    change(here.dataset.case!, here.dataset.s === '2' ? 0 : 2, 'quick')
    return
  }
  if (!e.key.startsWith('Arrow')) return
  const all = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-case]')]
  const a = here.getBoundingClientRect()
  const side = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
  let to: HTMLElement | undefined
  if (side) to = all[all.indexOf(here) + side]
  else {
    const down = e.key === 'ArrowDown'
    let best = Infinity
    for (const el of all) {
      const b = el.getBoundingClientRect()
      const dy = down ? b.top - a.top : a.top - b.top
      if (dy < a.height * 0.5) continue
      const d = dy * 4 + Math.abs(b.left - a.left)
      if (d < best) {
        best = d
        to = el
      }
    }
  }
  if (!to) return
  e.preventDefault()
  const link = to.querySelector<HTMLElement>('a')
  link?.focus()
}
