import { useLayoutEffect, useRef } from 'react'

const strip = Array.from({ length: 20 }, (_, i) => i % 10)
const spring = 'cubic-bezier(.2, 1.25, .35, 1)'

function Digit({ d, up, wait }: { d: number; up: boolean; wait: number }) {
  const col = useRef<HTMLSpanElement>(null)
  const was = useRef({ d, width: 0 })
  useLayoutEffect(() => {
    const box = col.current!
    const { d: from, width } = was.current
    const now = box.offsetWidth
    was.current = { d, width: now }
    if (from === d || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // roll on through 9 to 0 when counting up, and back through 0 to 9 when counting down
    const a = !up && d > from ? from + 10 : from
    const b = up && d < from ? d + 10 : d
    const timing = { duration: 620, delay: wait, fill: 'backwards', easing: spring } as const
    box.querySelector('.roll__strip')!.animate([{ transform: `translate(-50%, ${-a * 5}%)` }, { transform: `translate(-50%, ${-b * 5}%)` }], timing)
    if (width && width !== now) box.animate([{ width: `${width}px` }, { width: `${now}px` }], { ...timing, easing: 'cubic-bezier(.2, .8, .2, 1)' })
  }, [d, up, wait])
  return (
    <span className="roll__col" ref={col}>
      <span className="roll__ghost">{d}</span>
      <span className="roll__window">
        <span className="roll__strip" style={{ transform: `translate(-50%, ${-d * 5}%)` }}>
          {strip.map((n, i) => (
            <span key={i}>{n}</span>
          ))}
        </span>
      </span>
    </span>
  )
}

/** A number whose digits roll when it changes. */
export function Roll({ value }: { value: number }) {
  const was = useRef(value)
  const up = value >= was.current
  useLayoutEffect(() => {
    was.current = value
  }, [value])
  const digits = String(value).split('').map(Number)
  return (
    <span className="roll">
      <span className="sr">{value}</span>
      <span className="roll__digits" aria-hidden="true">
        {digits.map((d, i) => {
          const place = digits.length - i
          return <Digit key={place} d={d} up={up} wait={(place - 1) * 45} />
        })}
      </span>
    </span>
  )
}
