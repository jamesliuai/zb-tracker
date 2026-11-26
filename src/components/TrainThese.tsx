import { caseById, type Subset } from '../data/index.ts'
import { trainOf } from '../lib/router.ts'
import { setPrefs, usePrefs } from '../state/store.ts'
import { Icon } from './Icon.tsx'

/** Opens the trainer with a subset picked, and nothing else from its deck. */
export function TrainThese({ sub }: { sub: Subset }) {
  const prefs = usePrefs()
  const ids = sub.cases.map((c) => c.id)
  return (
    <a
      className="quiet"
      href={`#${trainOf(sub.deck)}`}
      onClick={() => setPrefs({ pool: { ...prefs.pool, [sub.deck]: 'pick' }, pick: [...prefs.pick.filter((id) => caseById.get(id)!.deck !== sub.deck), ...ids] })}
    >
      <Icon name="timer" size={14} /> Train these {ids.length}
    </a>
  )
}
