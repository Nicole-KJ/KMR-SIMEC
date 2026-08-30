import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, CalendarPlus, FileText, LogOut, ShieldCheck, BarChart3, Users, Sun, Moon, Settings, CalendarDays } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { getPublicBranding } from '../../services/supabaseDB'
import { logError } from '../../utils/logger'
import ProfileModal from '../ProfileModal'
import logo from '../../assets/brand/logo.png'

export default function Sidebar({ mobileOpen, onClose, collapsed }) {
  const { user, profile, signOut, isAdmin, isClient } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [showProfile, setShowProfile] = useState(false)
  const [branding, setBranding] = useState(null)
  const [avatarBroken, setAvatarBroken] = useState(false)

  // Custom logo (Personalización > Logo de la empresa) shows for every
  // session once uploaded, same as Login's own logo -- falls back to the
  // app's own K Maintenance Report logo when none is set. The "K
  // Maintenance Report" brand *name* text next to it stays client-only
  // (below) -- only the logo graphic itself is meant to reflect the
  // company's own branding for staff.
  useEffect(() => {
    getPublicBranding().catch(err => { logError('Sidebar.getPublicBranding', err); return null }).then(setBranding)
  }, [])

  // avatar_url can point at a file that's since been removed from storage --
  // re-attempt on every url change, but fall back to initials if it 404s.
  useEffect(() => { setAvatarBroken(false) }, [profile?.avatar_url])

  const initials = (profile?.full_name || user?.email || 'U')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <nav className={`sidebar ${mobileOpen ? 'mobile-open' : ''} ${collapsed ? 'collapsed' : ''}`}>
      {/* Header / Brand */}
      <div className="sidebar-header">
        <div className="sidebar-logo-icon">
          <img src={branding?.logo_url || logo} alt={branding?.company_name || 'K Maintenance Report'} />
        </div>
        <div className="sidebar-brand">
          {isClient && branding?.company_name ? (
            <h2>{branding.company_name}</h2>
          ) : (
            <>
              <h2>K Maintenance</h2>
              <span>Report</span>
            </>
          )}
        </div>
      </div>

      {/* New Event Button */}
      {!isClient && (
        <button className="sidebar-new-btn" onClick={() => { navigate('/eventos/nuevo'); onClose?.() }}>
          <CalendarPlus size={16} />
          Nuevo Evento
        </button>
      )}

      {/* Navigation */}
      <p className="nav-section-label">Menú</p>
      <ul className="nav-links">
        <li>
          <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}>
            <LayoutDashboard size={18} className="nav-icon" />
            Dashboard
          </NavLink>
        </li>
        {!isClient && (
          <li>
            <NavLink to="/eventos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={onClose}>
              <CalendarDays size={18} className="nav-icon" />
              Eventos
            </NavLink>
          </li>
        )}
        <li>
          <NavLink to="/reportes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}>
            <FileText size={18} className="nav-icon" />
            {isAdmin ? 'Todos los Reportes' : 'Mis Reportes'}
          </NavLink>
        </li>
        {!isClient && (
          <li>
            <NavLink to="/estadisticas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={onClose}>
              <BarChart3 size={18} className="nav-icon" />
              Estadísticas
            </NavLink>
          </li>
        )}
        {!isClient && (
          <li>
            <NavLink to="/clientes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={onClose}>
              <Users size={18} className="nav-icon" />
              Clientes
            </NavLink>
          </li>
        )}
        {isAdmin && (
          <li>
            <NavLink to="/admin/usuarios" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={onClose}>
              <ShieldCheck size={18} className="nav-icon" />
              Usuarios
            </NavLink>
          </li>
        )}
        {isAdmin && (
          <li>
            <NavLink to="/admin/configuracion" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={onClose}>
              <Settings size={18} className="nav-icon" />
              Configuración
            </NavLink>
          </li>
        )}
      </ul>

      {/* Footer: user + logout */}
      <div className="sidebar-footer">
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <button onClick={() => setShowProfile(true)}
            style={{ padding:0, border:'none', background:'none', cursor:'pointer', lineHeight:0 }}
            title="Ver mi perfil">
            {profile?.avatar_url && !avatarBroken ? (
              <img src={profile.avatar_url} alt="Foto de perfil" onError={() => setAvatarBroken(true)}
                style={{ width:34, height:34, borderRadius:'50%', objectFit:'cover', boxShadow:'var(--shadow-md)' }} />
            ) : (
              <div className="user-avatar" style={{ width:34, height:34, fontSize:12 }}>{initials}</div>
            )}
          </button>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:600 }}>{profile?.full_name || 'Técnico'}</div>
            <div style={{ fontSize:11, color:'var(--clr-text-light)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.email}</div>
          </div>
          <button className="icon-btn" onClick={toggleTheme}
            title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            style={{ flexShrink:0 }}>
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
        <button className="btn btn-secondary btn-sm btn-block" onClick={handleSignOut}>
          <LogOut size={14} /> Cerrar Sesión
        </button>
      </div>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </nav>
  )
}
