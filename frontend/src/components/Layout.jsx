import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { ClipboardList, Users, BarChart3, LogOut, PlusCircle } from 'lucide-react'

export default function Layout() {
  const navigate = useNavigate()
  const usuario = localStorage.getItem('usuario') || 'Chico'

  function sair() {
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    navigate('/login')
  }

  const navClass = ({ isActive }) =>
    `flex flex-col items-center gap-1 py-3 px-4 rounded-xl font-semibold text-sm transition-colors ` +
    (isActive ? 'bg-amber-600 text-white' : 'text-gray-600 hover:bg-amber-100')

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-amber-700 text-white px-4 py-3 flex items-center justify-between shadow-md no-print">
        <div>
          <h1 className="text-2xl font-extrabold leading-tight">Chico Sapateiro</h1>
          <p className="text-amber-200 text-sm">Olá, {usuario}</p>
        </div>
        <button
          onClick={sair}
          className="flex items-center gap-2 bg-amber-800 hover:bg-amber-900 px-3 py-2 rounded-xl text-sm font-semibold"
        >
          <LogOut size={18} />
          Sair
        </button>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 p-4 max-w-4xl mx-auto w-full">
        <Outlet />
      </main>

      {/* Navegação inferior (tablet-friendly) */}
      <nav className="bg-white border-t-2 border-gray-200 px-2 py-2 flex justify-around sticky bottom-0 shadow-lg no-print">
        <NavLink to="/painel" className={navClass}>
          <ClipboardList size={26} />
          Ordens
        </NavLink>
        <NavLink to="/nova-os" className={navClass}>
          <PlusCircle size={26} />
          Nova OS
        </NavLink>
        <NavLink to="/clientes" className={navClass}>
          <Users size={26} />
          Clientes
        </NavLink>
        <NavLink to="/relatorio" className={navClass}>
          <BarChart3 size={26} />
          Relatório
        </NavLink>
      </nav>
    </div>
  )
}
