import { homeOf, useRoute } from '../lib/router.ts'
import { inFlight } from '../reward/signals.ts'
import { playLearning } from '../reward/sound.ts'
import { setPrefs, usePrefs, useStats } from '../state/store.ts'
import { Icon } from './Icon.tsx'
import { Menu } from './Menu.tsx'
import { Roll } from './Roll.tsx'
import { Switcher } from './Switcher.tsx'

export function Header({ onSearch }: { onSearch: () => void }) {
  const route = useRoute()
  const { deck } = route
  const stats = useStats(deck.id)
  const { sound } = usePrefs()
  const shown = stats.learned - inFlight.use()
  const here = route.page === 'home' ? null : route.set.id

  return (
    <header className="top">
      <div className="top__in">
        <Switcher deck={deck} />
        <nav className="tabs" aria-label="Sets">
          {deck.sets.map((s) => (
            <a key={s.id} href={`#${s.id}`} data-set={s.id} data-label={s.short} aria-current={here === s.id ? 'true' : undefined} aria-label={`${s.name}, ${stats.bySet.get(s.id)} of ${s.cases.length} learned`} title={s.name}>
              {s.short}
              <i>
                <b style={{ scale: `${stats.bySet.get(s.id)! / s.cases.length} 1` }} />
              </i>
            </a>
          ))}
        </nav>
        <div className="tools">
          {route.page !== 'home' && (
            <a className="count" href={`#${homeOf(deck.id)}`} data-counter data-set={here ?? undefined} aria-label={`${stats.learned} of ${deck.cases.length} learned`}>
              <i className="cell" data-s="2" />
              <span>
                <Roll value={shown} />
              </span>
              <em>/{deck.cases.length}</em>
            </a>
          )}
          <button className="tool" onClick={onSearch} aria-label="Search" title="Search  /">
            <Icon name="search" />
          </button>
          <button
            className="tool"
            aria-pressed={sound}
            aria-label="Sound"
            title={sound ? 'Sound on' : 'Sound off'}
            onClick={() => {
              setPrefs({ sound: !sound })
              if (!sound) playLearning()
            }}
          >
            <Icon name={sound ? 'soundOn' : 'soundOff'} />
          </button>
          <Menu />
        </div>
      </div>
    </header>
  )
}
