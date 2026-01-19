import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ShieldCheck } from 'lucide-react'

const DiscordIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 127.14 96.36" fill="currentColor">
    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.36-24.44-5-47.25-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
  </svg>
)

const TelegramIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M21.4,2.8L2.2,10.2c-1.4,0.5-1.4,2.3-0.1,2.8l4.9,1.9l1.8,5.7c0.2,0.8,1.3,1,1.8,0.4l2.7-3.2l5,3.7c1.1,0.8,2.6,0,2.8-1.3L23.9,4C24.2,2.7,22.7,1.8,21.4,2.8z M10.6,14l-0.7,2.2l-1.2-3.8l10.8-6.7L10.6,14z" />
  </svg>
)

export const RegistrationScreen = ({ onVerificationComplete }) => {
  const [sessionIdentifier, setSessionIdentifier] = useState(null)
  const [isAwaitingResponse, setIsAwaitingResponse] = useState(false)
  const [authProvider, setAuthProvider] = useState(null)
  const [hoveredButton, setHoveredButton] = useState(null)

  // ВІДНОВЛЕНА ПРАВИЛЬНА ЛОГІКА POLLING-ЗАПИТІВ
  useEffect(() => {
    let pollingTimer

    if (isAwaitingResponse && sessionIdentifier) {
      pollingTimer = setInterval(async () => {
        try {
          const pollingResponse = await fetch(
            `https://obriy-auth.artomk-dev.workers.dev/api/auth/poll?sessionId=${sessionIdentifier}`
          )
          
          if (pollingResponse.ok) {
            const sessionResult = await pollingResponse.json()

            // Перевірка exactly як у старому робочому коді
            if (sessionResult.status === 'success') {
              clearInterval(pollingTimer)
              // Передаємо користувача батьківському компоненту
              if (onVerificationComplete) {
                onVerificationComplete(sessionResult.user)
              }
            }
          }
        } catch (requestError) {
          console.error('Auth polling error:', requestError)
        }
      }, 2000)
    }

    return () => clearInterval(pollingTimer)
  }, [isAwaitingResponse, sessionIdentifier, onVerificationComplete])

  const startDiscordAuthorization = () => {
    const uniqueId = crypto.randomUUID()
    setSessionIdentifier(uniqueId)
    setIsAwaitingResponse(true)
    setAuthProvider('Discord')

    const authorizationGatewayUrl = `https://obriy-auth.artomk-dev.workers.dev/api/auth/discord/init?sessionId=${uniqueId}`

    if (window.api && window.api.openExternal) {
      window.api.openExternal(authorizationGatewayUrl)
    } else {
      window.open(authorizationGatewayUrl, '_blank')
    }
  }

  const startTelegramAuthorization = () => {
    const uniqueId = crypto.randomUUID()
    setSessionIdentifier(uniqueId)
    setIsAwaitingResponse(true)
    setAuthProvider('Telegram')

    const authorizationGatewayUrl = `https://obriy-auth.artomk-dev.workers.dev/api/auth/telegram/init?sessionId=${uniqueId}`

    if (window.api && window.api.openExternal) {
      window.api.openExternal(authorizationGatewayUrl)
    } else {
      window.open(authorizationGatewayUrl, '_blank')
    }
  }

  const cancelAuthorization = () => {
    setIsAwaitingResponse(false)
    setAuthProvider(null)
    setSessionIdentifier(null)
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-gray-900 text-white overflow-hidden relative p-6">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />
      
      <div className="z-10 w-full max-w-md px-6 flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 flex flex-col items-center gap-4 text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10 shadow-2xl backdrop-blur-sm">
            <ShieldCheck className="h-8 w-8 text-white/80" />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-[0.2em] text-white/90">
              Авторизація
            </h2>
            <p className="mt-2 text-xs font-medium text-white/40 font-mono tracking-wide">
              Оберіть платформу для входу
            </p>
          </div>
        </motion.div>

        <div className="w-full relative min-h-[160px]">
          <AnimatePresence mode="wait">
            {!isAwaitingResponse ? (
              <motion.div
                key="selection"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center w-full"
              >
                <div className="flex gap-6 mb-6">
                  <button
                    onClick={startDiscordAuthorization}
                    onMouseEnter={() => setHoveredButton('Discord')}
                    onMouseLeave={() => setHoveredButton(null)}
                    className="group relative flex h-20 w-20 items-center justify-center rounded-2xl bg-[#5865F2]/10 transition-all duration-300 hover:bg-[#5865F2] hover:shadow-[0_0_30px_-5px_rgba(88,101,242,0.4)] border border-[#5865F2]/20 hover:border-[#5865F2] hover:-translate-y-1"
                  >
                    <div className="h-8 w-8 text-[#5865F2] transition-colors group-hover:text-white">
                      <DiscordIcon className="w-full h-full" />
                    </div>
                  </button>

                  <button
                    onClick={startTelegramAuthorization}
                    onMouseEnter={() => setHoveredButton('Telegram')}
                    onMouseLeave={() => setHoveredButton(null)}
                    className="group relative flex h-20 w-20 items-center justify-center rounded-2xl bg-[#24A1DE]/10 transition-all duration-300 hover:bg-[#24A1DE] hover:shadow-[0_0_30px_-5px_rgba(36,161,222,0.4)] border border-[#24A1DE]/20 hover:border-[#24A1DE] hover:-translate-y-1"
                  >
                    <div className="h-8 w-8 text-[#24A1DE] transition-colors group-hover:text-white">
                      <TelegramIcon className="w-full h-full" />
                    </div>
                  </button>
                </div>

                <div className="h-6 flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    {hoveredButton && (
                      <motion.span
                        key={hoveredButton}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="text-xs font-bold uppercase tracking-wider text-white/80"
                      >
                        {hoveredButton}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="awaiting"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center justify-center w-full py-2"
              >
                <div className="relative mb-8">
                  <div className={`h-20 w-20 rounded-full border-4 border-white/5 bg-transparent`} />
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className={`absolute inset-0 h-20 w-20 rounded-full border-t-4 ${authProvider === 'Telegram' ? 'border-[#24A1DE]' : 'border-[#5865F2]'}`}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {authProvider === 'Telegram' ? (
                        <TelegramIcon className="w-8 h-8 text-[#24A1DE]" />
                    ) : (
                        <DiscordIcon className="w-8 h-8 text-[#5865F2]" />
                    )}
                  </div>
                </div>

                <div className="text-center space-y-2 mb-6">
                  <p className={`text-xs font-bold uppercase tracking-widest ${authProvider === 'Telegram' ? 'text-[#24A1DE]' : 'text-[#5865F2]'} animate-pulse`}>
                    {authProvider === 'Telegram' ? 'Перевірте Telegram' : 'Перевірте Discord'}
                  </p>
                  <p className="text-[10px] font-mono text-white/30">
                    Очікування підтвердження входу...
                  </p>
                </div>

                <button
                  onClick={cancelAuthorization}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/80 transition-all text-[10px] font-bold uppercase tracking-widest border border-white/5 hover:border-white/20"
                >
                  <X size={12} />
                  <span>Скасувати</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}