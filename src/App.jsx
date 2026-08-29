import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout/Layout'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import ReportsList from './pages/ReportsList'
import Statistics from './pages/Statistics'
import NewReport from './pages/NewReport'
import ReportDetail from './pages/ReportDetail'
import SignaturePage from './pages/SignaturePage'
import AdminUsers from './pages/AdminUsers'
import UserDetail from './pages/UserDetail'
import Clientes from './pages/Clientes'
import ClienteDetail from './pages/ClienteDetail'
import AppCustomization from './pages/AppCustomization'
import LiberarEspacio from './pages/LiberarEspacio'
import Eventos from './pages/Eventos'
import NewEvento from './pages/NewEvento'
import EventDetail from './pages/EventDetail'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div className="loading-spinner" />
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div className="loading-spinner" />
    </div>
  )
  return isAdmin ? children : <Navigate to="/dashboard" replace />
}

// Blocks the "cliente" role from report-creation/edit and internal-metrics
// routes — a client only ever reads their own reports.
function NotClientRoute({ children }) {
  const { isClient, loading } = useAuth()
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div className="loading-spinner" />
    </div>
  )
  return isClient ? <Navigate to="/dashboard" replace /> : children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/recuperar-contrasena" element={<ForgotPassword />} />
      <Route path="/restablecer-contrasena" element={<ResetPassword />} />
      <Route path="/firma/:reportId" element={<SignaturePage />} />
      <Route path="/" element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="reportes" element={<ReportsList />} />
        <Route path="estadisticas" element={<NotClientRoute><Statistics /></NotClientRoute>} />
        <Route path="nuevo-reporte" element={<NotClientRoute><NewReport /></NotClientRoute>} />
        <Route path="reporte/:id" element={<ReportDetail />} />
        <Route path="reporte/:id/editar" element={<NotClientRoute><NewReport /></NotClientRoute>} />
        <Route path="admin/usuarios" element={<AdminRoute><AdminUsers /></AdminRoute>} />
        <Route path="admin/usuarios/:id" element={<AdminRoute><UserDetail /></AdminRoute>} />
        <Route path="admin/configuracion" element={<AdminRoute><AppCustomization /></AdminRoute>} />
        <Route path="admin/liberar-espacio" element={<AdminRoute><LiberarEspacio /></AdminRoute>} />
        <Route path="clientes" element={<NotClientRoute><Clientes /></NotClientRoute>} />
        <Route path="clientes/:id" element={<NotClientRoute><ClienteDetail /></NotClientRoute>} />
        <Route path="eventos" element={<NotClientRoute><Eventos /></NotClientRoute>} />
        <Route path="eventos/nuevo" element={<NotClientRoute><NewEvento /></NotClientRoute>} />
        <Route path="eventos/:id" element={<NotClientRoute><EventDetail /></NotClientRoute>} />
        <Route path="eventos/:id/editar" element={<NotClientRoute><NewEvento /></NotClientRoute>} />
      </Route>
    </Routes>
  )
}
