import React from 'react';
import { motion } from 'framer-motion';

export default function ProgressBar({ downloadProgress = 0, installProgress = 0, status, className = "" }) {
  // Визначаємо колір: Неоновий зелений за замовчуванням, Червоний при помилці
  const isError = status === 'error';
  const barColor = isError ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]' : 'bg-[#00ff88] shadow-[0_0_10px_rgba(0,255,136,0.6)]';

  return (
    <div className={`flex items-center gap-1 w-full h-2 ${className}`}>
      
      {/* ЛІВА ПОЛОВИНКА: ЗАВАНТАЖЕННЯ (DOWNLOAD) */}
      <div className="flex-1 h-full bg-white/10 rounded-l-sm overflow-hidden relative">
        {/* Фон (щоб було видно пусту частину) */}
        <div className="absolute inset-0 bg-black/20" />
        
        <motion.div
          // ФІКС: Починаємо не з 0, а з реального поточного значення.
          // Це прибирає ефект "перезапуску" анімації при зміні сторінок.
          initial={{ width: `${downloadProgress}%` }} 
          animate={{ width: `${downloadProgress}%` }}
          className={`h-full ${barColor} relative z-10`}
          transition={{ type: "spring", stiffness: 120, damping: 25 }} // Трохи плавніша анімація
        />
      </div>

      {/* РОЗДІЛЮВАЧ (ВІЗУАЛЬНИЙ РОЗРИВ) */}
      <div className="w-[1px] h-full bg-black/50" />

      {/* ПРАВА ПОЛОВИНКА: ВСТАНОВЛЕННЯ (INSTALL) */}
      <div className="flex-1 h-full bg-white/10 rounded-r-sm overflow-hidden relative">
        <div className="absolute inset-0 bg-black/20" />

        <motion.div
          // ФІКС: Те саме для інсталяції. Якщо ми зайшли на сторінку, а інсталяція вже йде,
          // бар буде одразу там, де треба.
          initial={{ width: `${installProgress}%` }}
          animate={{ width: `${installProgress}%` }}
          className={`h-full ${barColor} relative z-10`}
          transition={{ type: "spring", stiffness: 120, damping: 25 }}
        />
      </div>

    </div>
  );
}