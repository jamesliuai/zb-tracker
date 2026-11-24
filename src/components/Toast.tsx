import { subById } from '../data/index.ts'
import { shade } from '../lib/text.ts'
import { toast } from '../reward/signals.ts'

export function Toast() {
  const t = toast.use()
  return (
    <div className="toasts" role="status" aria-live="polite">
      {t && (
        <div className="toast" key={t.key} {...(t.sub ? shade(subById.get(t.sub)!) : {})}>
          {t.cells && (
            <span className="toast__cells" aria-hidden="true">
              {Array.from({ length: t.cells }, (_, i) => (
                <i key={i} style={{ '--i': i } as React.CSSProperties} />
              ))}
            </span>
          )}
          <span>{t.text}</span>
          {t.undo && (
            <button
              onClick={() => {
                t.undo!()
                toast.set(null)
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  )
}
