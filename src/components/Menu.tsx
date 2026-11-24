import { useRef, useState } from 'react'
import { layerClosing } from '../lib/layers.ts'
import { say } from '../reward/signals.ts'
import { canSave, emptyData, exportText, readData, replaceData, setPrefs, usePrefs } from '../state/store.ts'
import { Icon } from './Icon.tsx'
import { Segmented } from './Segmented.tsx'

const themes = [['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']] as const
const hands = [['two', 'Two-handed'], ['oh', 'One-handed']] as const

export function Menu() {
  const prefs = usePrefs()
  const pop = useRef<HTMLDivElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const [sure, setSure] = useState(false)
  const close = () => pop.current?.hidePopover()

  function save() {
    const day = new Date().toISOString().slice(0, 10)
    const url = URL.createObjectURL(new Blob([exportText()], { type: 'application/json' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `zbll-progress-${day}.json` })
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    close()
  }

  async function open(f: File | undefined) {
    if (!f) return
    close()
    let next = null
    try {
      next = readData(JSON.parse(await f.text()))
    } catch {
      // handled below
    }
    if (!next) return say({ text: 'That file isn’t a ZBLL progress export' })
    const undo = replaceData(next)
    say({ text: 'Progress imported', undo }, 8000)
  }

  return (
    <>
      <button className="tool" popoverTarget="menu" aria-label="Settings" title="Settings">
        <Icon name="more" />
      </button>
      <div
        className="menu"
        id="menu"
        popover="auto"
        ref={pop}
        onBeforeToggle={(e) => {
          if (e.newState === 'closed') layerClosing()
        }}
        onToggle={(e) => {
          if (e.newState === 'closed') setSure(false)
        }}
      >
        <div className="menu__row">
          <span>Appearance</span>
          <Segmented label="Appearance" value={prefs.theme} options={themes} onChange={(theme) => setPrefs({ theme })} />
        </div>
        <div className="menu__row">
          <span>Algorithms</span>
          <Segmented label="Algorithms" value={prefs.hand} options={hands} onChange={(hand) => setPrefs({ hand })} />
        </div>
        <hr />
        <button onClick={save}>Export progress</button>
        <button onClick={() => file.current?.click()}>Import progress</button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void open(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {sure ? (
          <button
            className="danger"
            onClick={() => {
              const undo = replaceData(emptyData())
              close()
              say({ text: 'Progress cleared', undo }, 10000)
            }}
          >
            Clear everything, including notes
          </button>
        ) : (
          <button onClick={() => setSure(true)}>Clear progress</button>
        )}
        <hr />
        <dl className="keys">
          <div>
            <dt>Search, or paste an algorithm</dt>
            <dd>
              <kbd>/</kbd>
            </dd>
          </div>
          <div>
            <dt>Mark learned</dt>
            <dd>
              <kbd>L</kbd>
            </dd>
          </div>
          <div>
            <dt>Next or previous case</dt>
            <dd>
              <kbd>←</kbd>
              <kbd>→</kbd>
            </dd>
          </div>
          <div>
            <dt>Turn the picture</dt>
            <dd>
              <kbd>U</kbd>
            </dd>
          </div>
        </dl>
        {!canSave && <p className="menu__warn">This browser window won’t save your progress. Export it before you close the tab.</p>}
      </div>
    </>
  )
}
