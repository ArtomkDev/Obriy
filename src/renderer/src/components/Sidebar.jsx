import { NavLink } from 'react-router-dom'

export default function Sidebar() {
  const linkClass = ({ isActive }) => 
    `block px-4 py-3 mb-1 rounded font-medium transition-all ${
      isActive ? 'bg-primary text-white shadow-lg shadow-pink-500/20' : 'text-textSec hover:bg-surface hover:text-white'
    }`

  return (
    <aside className="w-64 bg-surface h-screen flex flex-col p-4 border-r border-gray-800">
      <div className="mb-10 px-2 pt-2">
        <h1 className="text-2xl font-extrabold tracking-wider text-white">
          GTA <span className="text-primary">LAUNCHER</span>
        </h1>
      </div>

      <nav className="flex-1 space-y-1">
        <NavLink to="/" className={linkClass}>
          Моди
        </NavLink>
        <NavLink to="/settings" className={linkClass}>
          Налаштування
        </NavLink>
      </nav>

      <div className="text-xs text-gray-600 px-2 mt-auto border-t border-gray-800 pt-4">
        v0.1.0 Beta
      </div>
    </aside>
  )
}