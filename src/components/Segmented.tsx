/** A row of exclusive choices. The marker slides to the chosen one. */
export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  const at = options.findIndex(([v]) => v === value)
  return (
    <div className="seg" role="radiogroup" aria-label={label} style={{ '--n': options.length, '--at': at } as React.CSSProperties}>
      {options.map(([v, text]) => (
        <button
          key={v}
          role="radio"
          aria-checked={v === value}
          tabIndex={v === value ? 0 : -1}
          onClick={() => onChange(v)}
          onKeyDown={(e) => {
            const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
            if (!d) return
            e.preventDefault()
            e.stopPropagation()
            const next = (at + d + options.length) % options.length
            onChange(options[next][0])
            ;(e.currentTarget.parentElement!.children[next] as HTMLElement).focus()
          }}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
