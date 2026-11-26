import { memo, useRef } from 'react'
import { isSlot, turnU, type Turn } from '../cube/engine.ts'
import { arrows, bold, faces, facet, front, right, slots } from '../cube/geometry.ts'

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

/** Where the pieces go. A rim of sticker color keeps arrows apart where they cross, and whole across the gaps. */
const Arrows = memo(function Arrows({ ll }: { ll: string }) {
  const list = arrows(ll)
  if (!list.length) return null
  return (
    <g className="cube__arrows">
      {list.map(({ line, heads }) => (
        <g key={line}>
          <path className="arrow arrow--rim" d={line} />
          <path className="arrow__head arrow__head--rim" d={heads} />
          <path className="arrow" d={line} />
          <path className="arrow__head" d={heads} />
        </g>
      ))}
    </g>
  )
})

interface Picture {
  ll: string
  rot?: Turn
  label?: string
}

/** A case: its last layer from above, or for ZBLS the cube from above the slot. */
export const Cube = memo(function Cube(props: Picture) {
  return isSlot(props.ll) ? <SlotCube {...props} /> : <LayerCube {...props} />
})

/** The last layer seen from above. */
function LayerCube({ ll, rot = 0, label }: Picture) {
  const deg = useSpin(rot)
  return (
    <svg className="cube" viewBox="0 0 100 100" data-rot={rot} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <g className="cube__layer" style={{ transform: `rotate(${deg}deg)` }}>
        {slots.map((s, i) => (
          <rect key={i} data-i={i} className={`st-${ll[i]}`} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} />
        ))}
        <Arrows ll={ll} />
      </g>
    </svg>
  )
}

const nine = [0, 1, 2, 3, 4, 5, 6, 7, 8]
const grid = nine.map((i) => facet(Math.floor(i / 3), i % 3))

/** One sticker of a face. `s` says which sticker of the picture it shows, for when the case solves itself. */
function Sticker({ i, color, s }: { i: number; color: string; s?: number }) {
  const b = grid[i]
  return <rect data-s={s} className={`st-${color}`} x={b.x} y={b.y} width={b.w} height={b.h} rx={b.r} />
}

/**
 * ZBLS: the cube from above its front right corner, so the slot shows below the last layer. The top
 * turns the way a U turn does. The sides only change color, as what's on them comes round.
 */
function SlotCube({ ll, rot = 0, label }: Picture) {
  const deg = useSpin(rot)
  const seen = turnU(ll, rot)
  // an unlit picture leaves the whole cube unlit
  const own = (face: string) => (/[^X]/.test(ll) ? face : 'X')
  const side = (list: readonly (number | string)[]) =>
    list.map((k, i) => (typeof k === 'number' ? <Sticker key={i} i={i} s={k} color={(k < 21 ? seen : ll)[k]} /> : <Sticker key={i} i={i} color={own(k)} />))
  return (
    <svg className="cube cube--slot" viewBox="0 0 100 100" data-rot={rot} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <g transform={faces.U}>
        <g className="cube__top" style={{ transform: `rotate(${deg}deg)` }}>
          {nine.map((i) => (
            <Sticker key={i} i={i} s={i} color={ll[i]} />
          ))}
        </g>
      </g>
      <g transform={faces.F}>{side(front)}</g>
      <g transform={faces.R}>{side(right)}</g>
    </svg>
  )
}

/** Just the shape of a set: which stickers on top and around the sides are yellow. */
export const Glyph = memo(function Glyph({ ll }: { ll: string }) {
  if (isSlot(ll)) return <SlotGlyph ll={ll} />
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

const chunky = nine.map((i) => facet(Math.floor(i / 3), i % 3, 0.2))

/** For ZBLS, where the pair is: its stickers lit, with the white one paler. */
function SlotGlyph({ ll }: { ll: string }) {
  const look = (c: string) => (c === 'D' ? 'white' : c === 'F' || c === 'R' ? 'on' : 'off')
  const face = (colors: string[]) =>
    colors.map((c, i) => {
      const b = chunky[i]
      return <rect key={i} className={look(c)} x={b.x} y={b.y} width={b.w} height={b.h} rx={b.r} />
    })
  const pair = (list: readonly (number | string)[]) => list.map((k) => (typeof k === 'number' ? ll[k] : 'X'))
  return (
    <svg className="glyph glyph--slot" viewBox="0 0 100 100" aria-hidden="true">
      <g transform={faces.U}>
        <g className="glyph__top">{face(nine.map((i) => ll[i]))}</g>
      </g>
      <g transform={faces.F}>{face(pair(front))}</g>
      <g transform={faces.R}>{face(pair(right))}</g>
    </svg>
  )
}
