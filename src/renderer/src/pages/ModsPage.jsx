import { useState } from 'react'
import { modsData } from '../data/mods'

export default function ModsPage() {
  const [selectedMod, setSelectedMod] = useState(null)
  const [status, setStatus] = useState('idle') // idle, installing, success, error
  const [logs, setLogs] = useState('')

  const handleInstall = async () => {
    // 1. Отримуємо шлях до гри
    let gamePath = localStorage.getItem('gta_path')
    
    if (!gamePath) {
      alert("Спочатку вкажіть шлях до гри в налаштуваннях!")
      return
    }

    // --- ВИПРАВЛЕННЯ ШЛЯХУ (FIX) ---
    // Якщо шлях закінчується на GTA5.exe, ми прибираємо це, залишаючи тільки папку
    if (gamePath.toLowerCase().endsWith('gta5.exe')) {
       gamePath = gamePath.substring(0, gamePath.length - 8) // видаляємо "GTA5.exe"
       // Прибираємо зайвий слеш в кінці, якщо залишився
       if (gamePath.endsWith('\\') || gamePath.endsWith('/')) {
         gamePath = gamePath.slice(0, -1)
       }
    }

    if (!selectedMod.installConfig) {
      alert("Для цього мода ще не налаштована конфігурація інсталяції.")
      return
    }

    setStatus('installing')
    setLogs('Початок інсталяції...\n')

    try {
      // 2. Формуємо повний шлях до RPF
      const fullRpfPath = `${gamePath}\\${selectedMod.installConfig.targetRpf}`.replace(/\//g, '\\')
      
      setLogs(prev => prev + `Папка гри: ${gamePath}\n`)
      setLogs(prev => prev + `Цільовий RPF: ${fullRpfPath}\n`)

      // Перевіряємо, чи ми використовуємо URL чи тестовий файл
      // (Для сумісності з попереднім кроком перевіряємо обидва варіанти)
      const source = selectedMod.installConfig.url || selectedMod.installConfig.testSourceFile
      setLogs(prev => prev + `Джерело: ${source}\n`)

      // 3. Викликаємо міст (Bridge)
      // Electron сам вирішить: качати файл чи брати локальний
      const result = await window.api.installMod({
        rpfPath: fullRpfPath,
        internalPath: selectedMod.installConfig.internalPath,
        // Якщо є URL - передаємо url, якщо ні - sourceFile
        ...(selectedMod.installConfig.url ? { url: source } : { sourceFile: source })
      })

      if (result.status === 'success') {
        setStatus('success')
        setLogs(prev => prev + '✅ Успішно встановлено!')
      } else {
        setStatus('error')
        setLogs(prev => prev + `❌ Помилка від Engine: ${result.error || result.message}`)
      }

    } catch (e) {
      setStatus('error')
      setLogs(prev => prev + `❌ Критична помилка JS: ${e.message}`)
      console.error(e)
    }
  }

  if (selectedMod) {
    return (
      <div className="animate-fade-in h-full flex flex-col">
        <button 
          onClick={() => { setSelectedMod(null); setStatus('idle'); }}
          className="text-textSec hover:text-white mb-4 flex items-center gap-2 transition w-fit"
        >
          ← Назад до списку
        </button>

        <div className="bg-surface rounded-xl overflow-hidden shadow-2xl flex-1 flex flex-col">
          <div 
            className="h-64 bg-cover bg-center relative"
            style={{ backgroundImage: `url(${selectedMod.image})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-8">
               <h1 className="text-4xl font-extrabold text-white mb-2 drop-shadow-lg">{selectedMod.title}</h1>
               <p className="text-gray-300 font-medium">v{selectedMod.version} • {selectedMod.author}</p>
            </div>
          </div>

          <div className="p-8 flex-1">
            <div className="flex justify-between items-start gap-8">
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-4 text-primary">Про модифікацію</h3>
                <p className="text-gray-300 leading-relaxed text-lg">
                  {selectedMod.description}
                </p>
                
                {/* LOGS CONSOLE */}
                {status !== 'idle' && (
                  <div className="mt-6 bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-400 whitespace-pre-wrap border border-gray-800 h-48 overflow-y-auto">
                    {logs}
                  </div>
                )}
              </div>

              <div className="w-64 flex flex-col gap-4">
                 <button 
                  onClick={handleInstall}
                  disabled={status === 'installing'}
                  className={`
                    w-full py-4 rounded-xl font-bold text-lg shadow-lg transition transform active:scale-95
                    ${status === 'installing' ? 'bg-gray-600 cursor-wait' : 'bg-primary hover:bg-red-600 shadow-pink-500/20 text-white'}
                    ${status === 'success' ? 'bg-green-600 hover:bg-green-500' : ''}
                    ${status === 'error' ? 'bg-red-800 hover:bg-red-700' : ''}
                  `}
                >
                  {status === 'idle' && 'ВСТАНОВИТИ'}
                  {status === 'installing' && '⏳ ІНСТАЛЯЦІЯ...'}
                  {status === 'success' && '✅ ГОТОВО'}
                  {status === 'error' && '❌ ПОМИЛКА'}
                </button>
                
                <div className="text-center text-xs text-gray-500">
                  Потребує перезапуску гри після встановлення
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-white border-l-4 border-primary pl-3">
        Бібліотека Модів
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modsData.map((mod) => (
          <div 
            key={mod.id} 
            onClick={() => setSelectedMod(mod)}
            className="group bg-surface rounded-xl overflow-hidden hover:-translate-y-1 transition-all duration-300 cursor-pointer border border-transparent hover:border-gray-700 shadow-lg"
          >
            <div 
              className="h-48 bg-cover bg-center group-hover:scale-105 transition-transform duration-500"
              style={{ backgroundImage: `url(${mod.image})` }}
            ></div>
            
            <div className="p-5 relative bg-surface">
              <h3 className="font-bold text-lg mb-2 truncate text-white group-hover:text-primary transition-colors">{mod.title}</h3>
              <p className="text-textSec text-sm line-clamp-2 h-10 mb-4">
                {mod.description}
              </p>
              
              <div className="flex justify-between items-center border-t border-gray-800 pt-4">
                <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400 font-mono">v{mod.version}</span>
                <span className="text-primary text-sm font-bold group-hover:translate-x-1 transition-transform">Відкрити →</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}