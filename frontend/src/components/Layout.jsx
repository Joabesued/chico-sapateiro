import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { ClipboardList, Users, ShieldCheck, LogOut, PlusCircle, Archive } from 'lucide-react'

export default function Layout() {
  const navigate = useNavigate()
  const usuario = localStorage.getItem('usuario') || 'Chico'

  function sair() {
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    navigate('/login')
  }

  const navClass = ({ isActive }) =>
    `flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl font-semibold text-xs transition-colors ` +
    (isActive ? 'text-amber-700' : 'text-gray-500 hover:text-amber-600')

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
      <main className="flex-1 p-4 max-w-4xl mx-auto w-full pb-24">
        <Outlet />
      </main>

      {/* Navegação inferior — 5 abas */}
      <nav className="bg-white border-t-2 border-gray-200 px-1 flex justify-around items-end sticky bottom-0 shadow-lg no-print" style={{ paddingBottom: 'env(safe-area-inset-bottom, 4px)', paddingTop: '4px' }}>
        <NavLink to="/painel" className={navClass}>
          <ClipboardList size={24} />
          <span>Painel</span>
        </NavLink>

        <NavLink to="/arquivo" className={navClass}>
          <Archive size={24} />
          <span>Arquivo</span>
        </NavLink>

        {/* Nova OS — destaque central */}
        <NavLink to="/nova-os" className="flex flex-col items-center gap-0.5 -mt-4">
          {({ isActive }) => (
            <>
              <div className={`rounded-full p-3 shadow-lg transition-colors ` +
                (isActive ? 'bg-amber-700' : 'bg-amber-600 hover:bg-amber-700')}>
                <PlusCircle size={28} className="text-white" />
              </div>
              <span className={`text-xs font-bold transition-colors ` +
                (isActive ? 'text-amber-700' : 'text-gray-500')}>
                Nova OS
              </span>
            </>
          )}
        </NavLink>

        <NavLink to="/clientes" className={navClass}>
          <Users size={24} />
          <span>Clientes</span>
        </NavLink>

        <NavLink to="/admin" className={navClass}>
          <ShieldCheck size={24} />
          <span>Admin</span>
        </NavLink>
      </nav>
    </div>
  )
}
