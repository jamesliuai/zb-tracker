import { useRef } from 'react'
import { decks, type Deck } from '../data/index.ts'
import { layerClosing } from '../lib/layers.ts'
import { homeOf } from '../lib/router.ts'
import { useStats } from '../state/store.ts'
import { Icon } from './Icon.tsx'

function Choice({ deck, on, done }: { deck: Deck; on: boolean; done: () => void }) {
  const { learned, bySet } = useStats(deck.id)
  return (
    <a href={`#${homeOf(deck.id)}`} aria-current={on ? 'true' : undefined} aria-label={`${deck.id}, ${learned} of ${deck.cases.length} learned`} onClick={done}>
      <b>{deck.id}</b>
      <span className="num">
        {learned}
        <i>/{deck.cases.length}</i>
      </span>
      <span className="decks__bars">
        {deck.sets.map((s) => (
          <i key={s.id} data-set={s.id} style={{ flexGrow: s.cases.length }}>
            <b style={{ scale: `${bySet.get(s.id)! / s.cases.length} 1` }} />
          </i>
        ))}
      </span>
    </a>
  )
}

/** The name at the top left. It opens into everything there is to learn. */
export function Switcher({ deck }: { deck: Deck }) {
  const pop = useRef<HTMLElement>(null)
  const close = () => pop.current?.hidePopover()
  const step = (e: React.KeyboardEvent) => {
    const d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const menu = pop.current!
    const all = [...menu.querySelectorAll('a')]
    if (!menu.matches(':popover-open')) menu.showPopover()
    const at = all.indexOf(document.activeElement as HTMLAnchorElement)
    all[(at < 0 ? (d > 0 ? 0 : all.length - 1) : at + d + all.length) % all.length].focus()
  }
  return (
    <div onKeyDown={step}>
      <button className="brand" popoverTarget="decks" aria-label={`${deck.id}. Change what you’re learning`}>
        {deck.id}
        <Icon name="down" size={13} />
      </button>
      <nav
        className="menu decks"
        id="decks"
        popover="auto"
        aria-label="What you’re learning"
        ref={pop}
        onBeforeToggle={(e) => {
          if (e.newState === 'closed') layerClosing()
        }}
      >
        {decks.map((d) => (
          <Choice key={d.id} deck={d} on={d === deck} done={close} />
        ))}
      </nav>
    </div>
  )
}
