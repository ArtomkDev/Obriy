import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { InstallerProvider } from './context/InstallerContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <InstallerProvider>
        <App />
      </InstallerProvider>
    </HashRouter>
  </StrictMode>
)