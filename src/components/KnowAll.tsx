import { useState } from 'react'
import type { Subset } from '../data/index.ts'
import { learnMany } from '../reward/celebrate.ts'
import { useStats } from '../state/store.ts'

/** Marks whatever is left of a subset in one go. */
export function KnowAll({ sub }: { sub: Subset }) {
  const of = sub.cases.length
  const left = of - useStats(sub.deck).bySub.get(sub.id)!
  const [marking, setMarking] = useState(false)
  if (!left || marking) return null
  return (
    <button
      className="quiet"
      onClick={() => {
        setMarking(true)
        setTimeout(() => setMarking(false), 1400)
        learnMany(sub.cases.map((c) => c.id))
      }}
    >
      {left === of ? `Already know all ${left}?` : `Mark the other ${left} as learned`}
    </button>
  )
}
