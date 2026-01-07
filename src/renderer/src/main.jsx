import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { InstallerProvider } from './context/InstallerContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <InstallerProvider>
      <App />
    </InstallerProvider>
  </StrictMode>
)
