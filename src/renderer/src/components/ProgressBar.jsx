import React from 'react';
import { motion } from 'framer-motion';

export default function ProgressBar({ downloadProgress = 0, installProgress = 0, status, className = "" }) {
  const isError = status === 'error';
  const isInstalling = status === 'installing' || status === 'completed';
  
  const barColor = isError 
    ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]' 
    : 'bg-[#00ff88] shadow-[0_0_10px_rgba(0,255,136,0.6)]';

  const finalDownloadProgress = isInstalling ? 100 : downloadProgress;

  return (
    <div className={`flex items-center gap-1 w-full h-2 ${className}`}>
      
      <div className="flex-1 h-full bg-white/10 rounded-l-sm overflow-hidden relative">
        <div className="absolute inset-0 bg-black/20" />
        
        <motion.div
          initial={false}
          animate={{ width: `${finalDownloadProgress}%` }}
          className={`h-full ${barColor} relative z-10`}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
        />
      </div>

      <div className="w-[1px] h-full bg-black/50" />

      <div className="flex-1 h-full bg-white/10 rounded-r-sm overflow-hidden relative">
        <div className="absolute inset-0 bg-black/20" />

        <motion.div
          initial={false}
          animate={{ width: `${installProgress}%` }}
          className={`h-full ${barColor} relative z-10`}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
        />
      </div>

    </div>
  );
}