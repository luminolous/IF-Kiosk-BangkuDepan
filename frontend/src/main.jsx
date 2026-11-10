import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Kiosk from './pages/Kiosk.jsx'
import MobileControl from './pages/MobileControl.jsx'
import { BASE } from './lib/config'

// "/IF-Kiosk/mobile/" → "mobile". The trailing slash is optional, because
// GitHub Pages serves the phone page from mobile/index.html.
const page = window.location.pathname.slice(BASE.length).replace(/\/+$/, '')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {page === 'mobile' ? <MobileControl /> : <Kiosk />}
  </StrictMode>,
)
