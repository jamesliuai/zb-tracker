import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { asking, connect, disconnect, link, markSolved, warm } from '../smart/connect.ts'
import { Icon } from './Icon.tsx'

/** The cube that's connected, with what you can do about it, or why it didn't connect. */
export function CubeLine() {
  const l = link.use()
  // it's only shown once a smart cube is picked, so that's when to fetch what talking to one takes
  useEffect(warm, [])
  if (l.state === 'connecting') return <p className="cubeline">{l.note ?? 'Connecting'}…</p>
  if (l.state === 'off') return l.note ? <p className="cubeline cubeline--note">{l.note}</p> : null
  return (
    <p className="cubeline">
      <Icon name="cube" size={15} />
      <b>{l.name}</b>
      {l.battery !== undefined && <span className="num">{l.battery}%</span>}
      <span className="cubeline__do">
        <button className="quiet" onClick={markSolved} title="When the cube is solved but the trainer thinks it isn’t">
          Mark as solved
        </button>
        <button className="quiet" onClick={() => void disconnect()}>
          Disconnect
        </button>
      </span>
    </p>
  )
}

/** A button to connect a smart cube, or to let it go. */
export function CubeButton() {
  const l = link.use()
  const on = l.state === 'on'
  const label = on ? `${l.name}${l.battery !== undefined ? `, ${l.battery}%` : ''}. Disconnect` : l.state === 'connecting' ? 'Connecting' : 'Connect a smart cube'
  return (
    <button
      className="tool cubebutton"
      data-on={on || undefined}
      aria-busy={l.state === 'connecting' || undefined}
      onPointerEnter={warm}
      onPointerDown={warm}
      onFocus={warm}
      onClick={() => void (on ? disconnect() : connect())}
      aria-label={label}
      title={label}
    >
      <Icon name="cube" />
    </button>
  )
}

/** Six pairs of hex digits, however they were typed. */
const tidyMac = (text: string) => {
  const hex = text.toUpperCase().replace(/[^0-9A-F]/g, '')
  return hex.length === 12 ? hex.match(/../g)!.join(':') : null
}

/** GAN cubes, and some MoYu and QiYi ones, need their MAC address before they'll talk. When Chrome can't read it from the cube, it's asked for here, once. */
export function MacAsk() {
  const q = asking.use()
  const box = useRef<HTMLDialogElement>(null)
  const [text, setText] = useState('')
  const mac = tidyMac(text)

  useLayoutEffect(() => {
    const d = box.current!
    if (q && !d.open) {
      setText('')
      d.showModal()
    } else if (!q && d.open) d.close()
  }, [q])

  return (
    <dialog ref={box} className="palette mac" aria-labelledby="mac-title" onClose={() => asking.get()?.answer(null)} onKeyDown={(e) => e.stopPropagation()}>
      <form
        className="palette__in mac__in"
        onSubmit={(e) => {
          e.preventDefault()
          if (mac) q?.answer(mac)
        }}
      >
        <h2 id="mac-title">Your cube’s MAC address</h2>
        <p>
          {q?.name ?? 'Your cube'} needs it to connect. Chrome can read it from the cube by itself with <code>chrome://flags/#enable-experimental-web-platform-features</code> turned on. Or type it here, and it’s
          remembered.
        </p>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="AB:12:CD:34:EF:56" aria-label="MAC address" spellCheck={false} autoComplete="off" autoCapitalize="characters" autoFocus />
        <div className="mac__go">
          <button type="button" className="quiet" onClick={() => q?.answer(null)}>
            Cancel
          </button>
          <button className="btn btn--main" disabled={!mac}>
            Connect
          </button>
        </div>
      </form>
    </dialog>
  )
}
