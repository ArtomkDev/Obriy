import { Link, useLocation } from 'react-router-dom'

export default function Sidebar() {
  const location = useLocation()
  const isActive = (path) => location.pathname === path

  const NavTile = ({ to, label, active, icon }) => (
    <Link
      to={to}
      title={label}
      className={`
        relative group w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ease-out
        ${active 
          ? 'bg-indigo-600/80 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] scale-100 ring-1 ring-indigo-400' 
          : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white hover:scale-105'
        }
      `}
    >
      <div className={`w-5 h-5 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
        {icon}
      </div>
    </Link>
  )

  return (
    // ЗМІНА: backdrop-blur-xl та bg-black/20 для прозорості
    <aside className="w-20 h-full bg-black/20 backdrop-blur-xl border-r border-white/5 flex flex-col items-center py-6 z-40 select-none fixed left-0 top-0">
      
      {/* Logo */}
      <div className="mb-10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-lg shadow-lg">
          O
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-4 w-full items-center">
        <NavTile 
          to="/" 
          label="Library" 
          active={isActive('/')} 
          icon={<svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>}
        />
        <NavTile 
          to="/settings" 
          label="Settings" 
          active={isActive('/settings')} 
          icon={<svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.1.984.219 1.465.357.12.035.24.067.356.102.576.172.953.733.864 1.332-.158 1.05-.39 2.073-.685 3.036-.296.963-.67 1.89-1.11 2.774-.23.468-.67.834-1.166.962-.038.01-.078.02-.118.03a16.6 16.6 0 00-1.465.357m-9.18 5.48c-.962-.253-1.892-.584-2.783-.985-.55-.247-1.21-.06-1.511.463l-.38.657c-.318.551-.117 1.26.461 1.527.61.35 1.25.672 1.91.962.72.316 1.564.12 2.05-.515l.253-.332z" /></svg>}
        />
      </nav>

      <div className="mt-auto">
         <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
      </div>
    </aside>
  )
}