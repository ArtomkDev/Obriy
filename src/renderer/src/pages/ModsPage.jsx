import React, { useState } from 'react'
// ✅ ВИПРАВЛЕНО: Імпортуємо { modsData } точно так, як вона названа в mods.js
import { modsData } from '../data/mods'

export default function ModsPage() {
  const [selectedMod, setSelectedMod] = useState(null)
  const [status, setStatus] = useState('idle')
  const [logs, setLogs] = useState('')

  const handleInstall = async () => {
    // 1. Отримуємо шлях до гри
    let gamePath = localStorage.getItem('gta_path')
    
    if (!gamePath) {
      alert("Спочатку вкажіть шлях до гри в налаштуваннях!")
      return
    }

    // Виправлення шляху (видалення GTA5.exe)
    if (gamePath.toLowerCase().endsWith('gta5.exe')) {
       gamePath = gamePath.substring(0, gamePath.length - 8)
       if (gamePath.endsWith('\\') || gamePath.endsWith('/')) {
         gamePath = gamePath.slice(0, -1)
       }
    }

    // ✅ ВИПРАВЛЕНО: Перевіряємо instructions замість installConfig
    if (!selectedMod.instructions || selectedMod.instructions.length === 0) {
      alert("Цей мод не має інструкцій для встановлення.")
      return
    }

    setStatus('installing')
    setLogs('Початок інсталяції...\n')

    try {
      // ✅ ЦИКЛ: Проходимо по всіх інструкціях у моді
      for (const instruction of selectedMod.instructions) {
        
        // Формуємо повний шлях до RPF
        const fullRpfPath = `${gamePath}\\${instruction.rpfPath}`.replace(/\//g, '\\')
        
        setLogs(prev => prev + `------------------\n`)
        setLogs(prev => prev + `RPF: ${fullRpfPath}\n`)
        setLogs(prev => prev + `Файл: ${instruction.internalPath}\n`)

        // Визначаємо джерело (URL або локальний файл для тесту)
        // Ти використовуєш 'sourceFile' у своєму прикладі даних
        const source = instruction.sourceFile || instruction.url
        
        if (!source) {
          throw new Error("Не вказано sourceFile в інструкції")
        }

        // Викликаємо бекенд
        const result = await window.api.installMod({
          rpfPath: fullRpfPath,
          internalPath: instruction.internalPath,
          sourceFile: source
        })

        if (result && (result.status === 'success' || result.success === true)) {
          setLogs(prev => prev + '✅ OK\n')
        } else {
          throw new Error(result.error || result.message || 'Unknown error')
        }
      }

      // Якщо цикл пройшов без помилок
      setStatus('success')
      setLogs(prev => prev + '\n🎉 Всі файли мода успішно встановлено!')

    } catch (e) {
      setStatus('error')
      setLogs(prev => prev + `\n❌ ПОМИЛКА: ${e.message}`)
      console.error(e)
    }
  }

  // --- РЕНДЕР СТОРІНКИ МОДА ---
  if (selectedMod) {
    return (
      <div className="animate-fade-in h-full flex flex-col">
        <button 
          onClick={() => { setSelectedMod(null); setStatus('idle'); setLogs(''); }}
          className="text-gray-400 hover:text-white mb-4 flex items-center gap-2 transition w-fit"
        >
          ← Назад до списку
        </button>

        <div className="bg-gray-900/80 rounded-xl overflow-hidden shadow-2xl flex-1 flex flex-col border border-gray-700">
          <div 
            className="h-64 bg-cover bg-center relative"
            style={{ backgroundImage: `url(${selectedMod.image})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-8">
               <h1 className="text-4xl font-extrabold text-white mb-2 drop-shadow-lg">{selectedMod.title}</h1>
               <p className="text-gray-300 font-medium">v{selectedMod.version || '1.0'} • {selectedMod.author || 'Unknown'}</p>
            </div>
          </div>

          <div className="p-8 flex-1 flex flex-col md:flex-row gap-8">
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-4 text-blue-400">Про модифікацію</h3>
              <p className="text-gray-300 leading-relaxed text-lg mb-6">
                {selectedMod.description}
              </p>
              
              {/* Логи */}
              {status !== 'idle' && (
                <div className="mt-4 bg-black rounded-lg border border-gray-700 p-4 h-48 overflow-y-auto font-mono text-sm shadow-inner">
                  <pre className="text-green-400 whitespace-pre-wrap">{logs}</pre>
                </div>
              )}
            </div>

            <div className="w-full md:w-72 flex flex-col gap-4">
               <button 
                 onClick={handleInstall}
                 disabled={status === 'installing'}
                 className={`
                   w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform active:scale-95
                   flex items-center justify-center gap-2
                   ${status === 'installing' ? 'bg-gray-600 cursor-wait text-gray-300' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'}
                   ${status === 'success' ? '!bg-green-600 hover:!bg-green-500' : ''}
                   ${status === 'error' ? '!bg-red-600 hover:!bg-red-500' : ''}
                 `}
               >
                 {status === 'idle' && 'ВСТАНОВИТИ'}
                 {status === 'installing' && '⏳ ІНСТАЛЯЦІЯ...'}
                 {status === 'success' && '✅ ГОТОВО'}
                 {status === 'error' && '❌ ПОМИЛКА'}
               </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- СПИСОК МОДІВ ---
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-white border-l-4 border-blue-500 pl-3">
        Бібліотека Модів
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modsData.map((mod) => (
          <div 
            key={mod.id} 
            onClick={() => setSelectedMod(mod)}
            className="group bg-gray-800 rounded-xl overflow-hidden hover:-translate-y-1 transition-all duration-300 cursor-pointer border border-gray-700 hover:border-blue-500/50 shadow-lg"
          >
            <div 
              className="h-48 bg-cover bg-center group-hover:scale-105 transition-transform duration-500"
              style={{ backgroundImage: `url(${mod.image})` }}
            >
                <div className="w-full h-full bg-black/20 group-hover:bg-transparent transition-colors"></div>
            </div>
            
            <div className="p-5 relative">
              <h3 className="font-bold text-lg mb-2 truncate text-white group-hover:text-blue-400 transition-colors">{mod.title}</h3>
              <p className="text-gray-400 text-sm line-clamp-2 h-10 mb-4">
                {mod.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}