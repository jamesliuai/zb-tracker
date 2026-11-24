import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

/** A quiet line of text you can write on. It grows as you type and saves itself. */
export function Note({ label, value, placeholder, onSave }: { label: string; value: string; placeholder: string; onSave: (v: string) => void }) {
  const id = useId()
  const el = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState(value)
  const saved = useRef(value)
  const save = useRef(onSave)
  save.current = onSave

  // another tab, an undo or an import changed it
  useEffect(() => {
    if (value !== saved.current) {
      saved.current = value
      setText(value)
    }
  }, [value])

  useLayoutEffect(() => {
    const t = el.current
    if (!t) return
    const fit = () => {
      t.style.height = '0'
      t.style.height = `${t.scrollHeight}px`
    }
    fit()
    let width = t.clientWidth
    const ro = new ResizeObserver(() => {
      if (t.clientWidth !== width) {
        width = t.clientWidth
        fit()
      }
    })
    ro.observe(t)
    return () => ro.disconnect()
  }, [text])

  return (
    <div className="note">
      <label htmlFor={id}>{label}</label>
      <textarea
        ref={el}
        id={id}
        rows={1}
        value={text}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => {
          const v = e.target.value
          setText(v)
          saved.current = v
          save.current(v)
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape') e.currentTarget.blur()
        }}
      />
    </div>
  )
}
