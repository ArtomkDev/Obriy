import React from 'react'

export default function PageLayout({ 
  pageTitleText, 
  pageSubtitleText, 
  headerAccessoryElement, 
  footerContentElement, 
  children 
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0 h-full w-full animate-fade-in relative">
      <div className="p-8 pb-6 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase drop-shadow-lg pl-2">
            {pageTitleText}
          </h2>
          {pageSubtitleText && (
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-2 pl-2">
              {pageSubtitleText}
            </p>
          )}
        </div>
        
        {headerAccessoryElement && (
          <div>
            {headerAccessoryElement}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-20 relative space-y-6">
        {children}
      </div>

      {footerContentElement && (
        <div className="mt-auto shrink-0 w-full flex justify-center pb-6 pt-4 opacity-30">
          {footerContentElement}
        </div>
      )}
    </div>
  )
}