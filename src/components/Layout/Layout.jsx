import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { Menu, ChevronLeft, ChevronRight } from 'lucide-react'

const COLLAPSE_STORAGE_KEY = 'simec-sidebar-collapsed'

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true')

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next))
      return next
    })
  }

  return (
    <div className="app-container">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:99 }} />
      )}

      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} collapsed={collapsed} />

      <button className={`sidebar-toggle-btn ${collapsed ? 'collapsed' : ''}`}
        onClick={toggleCollapsed}
        title={collapsed ? 'Mostrar menú' : 'Ocultar menú'}>
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div className={`main-content ${collapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Mobile header -- shown only under 768px, see .mobile-top-bar (index.css) */}
        <div className="mobile-top-bar">
          <button className="icon-btn" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>
          <span style={{ fontWeight:700 }}>K Maintenance Report</span>
          <div style={{ width:36 }} />
        </div>

        <Outlet />
      </div>
    </div>
  )
}
