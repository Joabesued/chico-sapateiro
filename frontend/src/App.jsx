import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Layout from './components/Layout.jsx'
import Painel from './pages/Painel.jsx'
import NovaOS from './pages/NovaOS.jsx'
import DetalhesOS from './pages/DetalhesOS.jsx'
import Clientes from './pages/Clientes.jsx'
import ClienteDetalhe from './pages/ClienteDetalhe.jsx'
import Relatorio from './pages/Relatorio.jsx'
import Admin from './pages/Admin.jsx'

function RotaProtegida({ children }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <RotaProtegida>
          <Layout />
        </RotaProtegida>
      }>
        <Route index element={<Navigate to="/painel" replace />} />
        <Route path="painel" element={<Painel />} />
        <Route path="nova-os" element={<NovaOS />} />
        <Route path="os/:id" element={<DetalhesOS />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="clientes/:id" element={<ClienteDetalhe />} />
        <Route path="relatorio" element={<Relatorio />} />
        <Route path="admin" element={<Admin />} />
      </Route>
    </Routes>
  )
}
