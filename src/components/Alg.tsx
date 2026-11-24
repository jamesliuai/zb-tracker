import { AUF, type Turn } from '../cube/engine.ts'

const pretty = (s: string) => s.replaceAll("'", '′')

/** An algorithm with proper primes. Brackets and alternatives are quieter than the moves. */
export function Alg({ text }: { text: string }) {
  return (
    <span className="alg">
      {text
        .split(/([()]|\s\/\s)/)
        .filter(Boolean)
        .map((part, i) => (/^[()]$|\//.test(part) ? <i key={i}>{part}</i> : pretty(part)))}
    </span>
  )
}

/** The AUF to do first. Shows an empty slot when there is none, so algorithms stay lined up. */
export function Auf({ turn }: { turn: Turn }) {
  if (!turn) return <span className="auf auf--none" aria-hidden="true" />
  return (
    <span className="auf" title={`Do ${pretty(AUF[turn])} first`}>
      <span className="sr">AUF </span>
      {pretty(AUF[turn])}
    </span>
  )
}

/** Selecting and copying an algorithm gives plain apostrophes. */
if (typeof document !== 'undefined')
  document.addEventListener('copy', (e) => {
    const text = getSelection()?.toString()
    if (!text?.includes('′')) return
    e.clipboardData?.setData('text/plain', text.replaceAll('′', "'"))
    e.preventDefault()
  })
