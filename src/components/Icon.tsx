const paths = {
  search: 'M10.5 10.5 14 14M12 7A5 5 0 1 1 2 7a5 5 0 0 1 10 0Z',
  soundOn: 'M2 6.2v3.6h2.4L7.6 12.6V3.4L4.4 6.2H2ZM10.2 6a2.8 2.8 0 0 1 0 4M12.2 4a5.6 5.6 0 0 1 0 8',
  soundOff: 'M2 6.2v3.6h2.4L7.6 12.6V3.4L4.4 6.2H2ZM10.6 6.4l3.2 3.2M13.8 6.4l-3.2 3.2',
  more: 'M3.2 8h.01M8 8h.01M12.8 8h.01',
  check: 'm3.4 8.4 3 3 6.2-6.6',
  left: 'M9.8 3.4 5.2 8l4.6 4.6',
  right: 'm6.2 3.4 4.6 4.6-4.6 4.6',
  turn: 'M12.8 6.6A5 5 0 1 0 13 9M13 3.4v3.4H9.6',
  copy: 'M5.6 5.6V3.8A1.3 1.3 0 0 1 6.9 2.5h5.3a1.3 1.3 0 0 1 1.3 1.3v5.3a1.3 1.3 0 0 1-1.3 1.3h-1.8M3.8 5.6h5.3a1.3 1.3 0 0 1 1.3 1.3v5.3a1.3 1.3 0 0 1-1.3 1.3H3.8a1.3 1.3 0 0 1-1.3-1.3V6.9a1.3 1.3 0 0 1 1.3-1.3Z',
  plus: 'M8 3.2v9.6M3.2 8h9.6',
  close: 'm4 4 8 8M12 4l-8 8',
  down: 'm3.6 6.2 4.4 4.4 4.4-4.4',
} as const

export type IconName = keyof typeof paths

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <path d={paths[name]} strokeWidth={name === 'more' ? 2.2 : 1.5} />
    </svg>
  )
}
