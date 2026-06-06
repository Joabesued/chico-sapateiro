import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { ClipboardList, Users, ShieldCheck, LogOut, Plus, Archive, Package } from 'lucide-react'
const _logoFiles = import.meta.glob('../assets/logo.png', { eager: true, import: 'default' })
const logo = Object.values(_logoFiles)[0] || null

export default function Layout() {
  const navigate = useNavigate()
  const usuario = localStorage.getItem('usuario') || 'Chico'

  function sair() {
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    navigate('/login')
  }

  const navClass = ({ isActive }) =>
    `flex flex-col items-center gap-0.5 py-2 px-2 rounded-xl font-semibold text-xs transition-colors ` +
    (isActive ? 'text-[#3E1F12]' : 'text-[#999999] hover:text-[#3E1F12]')

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#FAFAFA' }}>
      {/* Header */}
      <header className="bg-white px-4 py-3 flex items-center justify-between no-print" style={{ borderBottom: '1px solid #F0F0F0' }}>
        <div className="flex items-center gap-3">
          {logo ? (
            <img
              src={logo}
              alt="Chico Sapateiro"
              style={{ height: 40, width: 'auto', objectFit: 'contain' }}
            />
          ) : (
            <div style={{ backgroundColor: '#3E1F12', borderRadius: 12, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              👟
            </div>
          )}
          <div>
            <span className="text-base font-bold" style={{ color: '#1A1A1A' }}>Chico</span>
            <span className="text-sm ml-1" style={{ color: '#999999' }}>Sapateiro · Gestão</span>
          </div>
        </div>
        <button
          onClick={sair}
          className="flex items-center gap-1.5 px-2 py-2 rounded-lg transition-colors text-sm font-semibold"
          style={{ color: '#999999' }}
          onMouseEnter={e => e.currentTarget.style.color = '#3E1F12'}
          onMouseLeave={e => e.currentTarget.style.color = '#999999'}
        >
          <LogOut size={16} />
          Sair
        </button>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 p-4 max-w-4xl mx-auto w-full pb-24">
        <Outlet />
      </main>

      {/* Navegação inferior */}
      <nav
        className="bg-white px-1 flex justify-around items-end sticky bottom-0 no-print"
        style={{ borderTop: '1px solid #F0F0F0', boxShadow: '0 -1px 8px rgba(0,0,0,0.04)', paddingBottom: 'env(safe-area-inset-bottom, 4px)', paddingTop: '4px' }}
      >
        <NavLink to="/painel" className={navClass}>
          <ClipboardList size={22} />
          <span>Painel</span>
        </NavLink>

        <NavLink to="/arquivo" className={navClass}>
          <Archive size={22} />
          <span>Arquivo</span>
        </NavLink>

        {/* Nova OS — destaque central */}
        <NavLink to="/nova-os" className="flex flex-col items-center gap-0.5 -mt-5">
          {({ isActive }) => (
            <>
              <div
                className="rounded-full p-3.5 shadow-lg transition-colors flex items-center justify-center"
                style={{ backgroundColor: isActive ? '#2d1609' : '#3E1F12' }}
              >
                <Plus size={26} className="text-white" />
              </div>
              <span className="text-xs font-bold transition-colors" style={{ color: isActive ? '#3E1F12' : '#999999' }}>
                Nova OS
              </span>
            </>
          )}
        </NavLink>

        <NavLink to="/produtos" className={navClass}>
          <Package size={22} />
          <span>Produtos</span>
        </NavLink>

        <NavLink to="/clientes" className={navClass}>
          <Users size={22} />
          <span>Clientes</span>
        </NavLink>

        <NavLink to="/admin" className={navClass}>
          <ShieldCheck size={22} />
          <span>Admin</span>
        </NavLink>
      </nav>
    </div>
  )
}
