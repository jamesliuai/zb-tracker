import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { Finale } from './components/Finale.tsx'
import { Header } from './components/Header.tsx'
import { Palette } from './components/Palette.tsx'
import { Toast } from './components/Toast.tsx'
import { useRoute } from './lib/router.ts'
import { CasePage } from './pages/CasePage.tsx'
import { Home } from './pages/Home.tsx'
import { SetPage } from './pages/SetPage.tsx'
import { SubsetPage } from './pages/SubsetPage.tsx'
import { finale } from './reward/signals.ts'
import { usePrefs } from './state/store.ts'

function useTheme() {
  const { theme } = usePrefs()
  useEffect(() => {
    const dark = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const t = theme === 'system' ? (dark.matches ? 'dark' : 'light') : theme
      document.documentElement.dataset.theme = t
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0f1115' : '#f5f6f8')
    }
    apply()
    dark.addEventListener('change', apply)
    return () => dark.removeEventListener('change', apply)
  }, [theme])
}

export function App() {
  useTheme()
  const route = useRoute()
  const [searching, setSearching] = useState(false)
  const celebrating = finale.use() !== null

  useEffect(() => {
    document.title = route.page === 'home' ? 'ZBLL Tracker' : `${route.page === 'set' ? route.set.name : route.page === 'sub' ? route.sub.id : route.case.id} · ZBLL Tracker`
  }, [route])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest?.('input, textarea')
      if (finale.get()) return
      if ((e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) || (e.key === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault()
        flushSync(() => setSearching(true))
      }
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [])

  return (
    <>
      <div inert={celebrating}>
        <Header onSearch={() => setSearching(true)} />
        {route.page === 'home' && <Home />}
        {route.page === 'set' && <SetPage key={route.set.id} set={route.set} />}
        {route.page === 'sub' && <SubsetPage key={route.sub.id} set={route.set} sub={route.sub} />}
        {route.page === 'case' && <CasePage key={route.case.id} c={route.case} sub={route.sub} set={route.set} />}
      </div>
      <Palette open={searching} onClose={() => setSearching(false)} />
      <Toast />
      <Finale />
    </>
  )
}
