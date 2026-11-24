import { finale } from '../reward/signals.ts'

let closedAt = 0
/** Call when a popover is about to close, because Escape reaches the page as well. */
export const layerClosing = () => {
  closedAt = performance.now()
}

/** True while something is open above the page, so its keys should do nothing. */
export const covered = () => finale.get() !== null || performance.now() - closedAt < 80 || document.querySelector('dialog[open], :popover-open') !== null
