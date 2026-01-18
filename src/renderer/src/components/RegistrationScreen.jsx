import React, { useState, useEffect } from 'react';

export const RegistrationScreen = ({ onVerificationComplete }) => {
  const [sessionIdentifier, setSessionIdentifier] = useState(null);
  const [isAwaitingResponse, setIsAwaitingResponse] = useState(false);

  const startDiscordAuthorization = () => {
    const uniqueId = crypto.randomUUID();
    setSessionIdentifier(uniqueId);
    setIsAwaitingResponse(true);

    const authorizationGatewayUrl = `https://obriy-auth.artomk-dev.workers.dev/api/auth/discord/init?sessionId=${uniqueId}`;
    
    if (window.api && window.api.openExternal) {
      window.api.openExternal(authorizationGatewayUrl);
    } else {
      window.open(authorizationGatewayUrl, '_blank');
    }
  };

  useEffect(() => {
    let pollingTimer;

    if (isAwaitingResponse && sessionIdentifier) {
      pollingTimer = setInterval(async () => {
        try {
          const pollingResponse = await fetch(`https://obriy-auth.artomk-dev.workers.dev/api/auth/poll?sessionId=${sessionIdentifier}`);
          const sessionResult = await pollingResponse.json();

          if (sessionResult.status === "success") {
            clearInterval(pollingTimer);
            onVerificationComplete(sessionResult.user);
          }
        } catch (requestError) {
          console.error(requestError.message);
        }
      }, 2000);
    }

    return () => clearInterval(pollingTimer);
  }, [isAwaitingResponse, sessionIdentifier, onVerificationComplete]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col items-center space-y-2">
        <h2 className="text-4xl font-black italic uppercase text-orange-500 tracking-tighter italic">
          Obriy Launcher
        </h2>
        <p className="text-zinc-500 text-[10px] uppercase tracking-[0.4em] font-bold">
          Вхід у систему модифікацій
        </p>
      </div>

      {!isAwaitingResponse ? (
        <div className="flex flex-col space-y-3 w-full max-w-[260px]">
          <button
            onClick={startDiscordAuthorization}
            className="group relative flex items-center justify-center py-5 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl transition-all duration-300 shadow-2xl shadow-blue-900/20"
          >
            <span className="relative z-10 font-black uppercase italic tracking-widest text-xs">Авторизація Discord</span>
          </button>
          
          <div className="pt-4 flex flex-col items-center">
            <p className="text-zinc-600 text-[8px] uppercase font-bold text-center leading-relaxed">
              Натискаючи на кнопку, ви погоджуєтесь <br /> з правилами використання проекту Obriy
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-6">
          <div className="relative">
            <div className="w-16 h-16 border-2 border-zinc-800 rounded-full"></div>
            <div className="absolute inset-0 w-16 h-16 border-t-2 border-orange-500 rounded-full animate-spin"></div>
          </div>
          <div className="flex flex-col items-center space-y-1">
            <p className="text-white text-[11px] font-bold uppercase tracking-widest animate-pulse">
              Очікування підтвердження
            </p>
            <button 
              onClick={() => setIsAwaitingResponse(false)}
              className="text-zinc-600 hover:text-zinc-400 text-[9px] uppercase font-bold underline transition-colors"
            >
              Скасувати запит
            </button>
          </div>
        </div>
      )}
    </div>
  );
};