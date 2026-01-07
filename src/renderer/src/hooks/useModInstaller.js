import { useState } from 'react'

const getTimestamp = () => {
  const now = new Date()
  return now.toLocaleTimeString('uk-UA', { hour12: false }) + '.' + now.getMilliseconds().toString().padStart(3, '0')
}

export function useModInstaller() {
  const [status, setStatus] = useState('idle') // 'idle', 'installing', 'success', 'error'
  const [logs, setLogs] = useState([])

  const addLog = (message, type = 'SYS') => {
    setLogs(prev => [...prev, { time: getTimestamp(), type, message }])
  }

  const installMod = async (mod) => {
    if (!mod) return

    setStatus('installing')
    setLogs([]) 
    addLog("Sequence initiated...", "INIT")

    let gamePath = localStorage.getItem('gamePath') || localStorage.getItem('gta_path')

    if (!gamePath) {
      setStatus('error')
      addLog("CONFIG ERROR: Game path undefined.", 'ERR')
      return
    }

    // Нормалізація шляху
    if (gamePath.toLowerCase().endsWith('gta5.exe')) {
       gamePath = gamePath.substring(0, gamePath.length - 8)
    }
    if (gamePath.endsWith('\\') || gamePath.endsWith('/')) {
       gamePath = gamePath.slice(0, -1)
    }
    
    if (!mod.instructions?.length) {
      setStatus('error')
      addLog("MANIFEST ERROR: Instructions array empty.", 'ERR')
      return
    }

    addLog(`Target: ${gamePath}`)
    addLog(`Package: ${mod.title} [v${mod.version}]`)

    try {
      addLog("Injecting payload via IPC bridge...", "NET")
      const result = await window.api.installMod(gamePath, mod.instructions) //

      if (result && (result.status === 'success' || result.success === true)) {
        setStatus('success')
        addLog("Core returned status: OK", "OK")
        addLog("Installation finalized.", "DONE")
      } else {
        throw new Error(result.error || result.message || 'Unknown error')
      }
    } catch (e) {
      setStatus('error')
      addLog(`FATAL: ${e.message}`, 'ERR')
    }
  }

  const copyLogs = () => {
    const textLog = logs.map(l => `[${l.time}] [${l.type}] ${l.message}`).join('\n')
    navigator.clipboard.writeText(textLog)
  }

  return { status, logs, installMod, copyLogs, setStatus }
}