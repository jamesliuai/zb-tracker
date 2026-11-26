/** A row of exclusive choices. The marker slides to the chosen one, and hides when none of them is. */
export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T | null; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  const at = options.findIndex(([v]) => v === value)
  return (
    <div className="seg" role="radiogroup" aria-label={label} data-none={at < 0 || undefined} style={{ '--n': options.length, '--at': Math.max(0, at) } as React.CSSProperties}>
      {options.map(([v, text], i) => (
        <button
          key={v}
          role="radio"
          aria-checked={v === value}
          tabIndex={i === Math.max(0, at) ? 0 : -1}
          onClick={() => onChange(v)}
          onKeyDown={(e) => {
            const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
            if (!d) return
            e.preventDefault()
            e.stopPropagation()
            const next = (i + d + options.length) % options.length
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
