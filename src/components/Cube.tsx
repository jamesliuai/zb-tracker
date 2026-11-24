import { memo, useRef } from 'react'
import type { Turn } from '../cube/engine.ts'
import { bold, slots } from '../cube/geometry.ts'

/** Degrees that always turn the short way, so three quarter turns become one back. */
function useSpin(rot: Turn) {
  const ref = useRef({ rot, deg: rot * 90 })
  const was = ref.current
  if (was.rot !== rot) {
    const d = (rot - was.rot + 4) % 4
    ref.current = { rot, deg: was.deg + (d === 3 ? -90 : d * 90) }
  }
  return ref.current.deg
}

/** The last layer seen from above. */
export const Cube = memo(function Cube({ ll, rot = 0, label }: { ll: string; rot?: Turn; label?: string }) {
  const deg = useSpin(rot)
  return (
    <svg className="cube" viewBox="0 0 100 100" data-rot={rot} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <g className="cube__layer" style={{ transform: `rotate(${deg}deg)` }}>
        {slots.map((s, i) => (
          <rect key={i} data-i={i} className={`st-${ll[i]}`} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} />
        ))}
      </g>
    </svg>
  )
})

/** Just the shape of a set: which stickers on top and around the sides are yellow. */
export const Glyph = memo(function Glyph({ ll }: { ll: string }) {
  return (
    <svg className="glyph" viewBox="0 0 100 100" aria-hidden="true">
      {bold.map((s, i) => {
        const on = ll[i] === 'U'
        if (i > 8 && !on) return null
        return <rect key={i} className={on ? 'on' : 'off'} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} />
      })}
    </svg>
  )
})
