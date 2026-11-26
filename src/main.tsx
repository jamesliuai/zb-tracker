import './styles/fonts.css'
import './styles/base.css'
import './styles/parts.css'
import './styles/home.css'
import './styles/set.css'
import './styles/case.css'
import './styles/overlay.css'
import './styles/train.css'
import './styles/drill.css'
import { createRoot } from 'react-dom/client'
import { App } from './app.tsx'

createRoot(document.getElementById('root')!).render(<App />)
