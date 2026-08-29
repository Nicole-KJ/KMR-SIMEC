import { Component } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { logError } from '../utils/logger'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    logError('ErrorBoundary', error, { componentStack: info.componentStack })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--clr-bg)', padding: 24,
      }}>
        <div style={{
          background: 'var(--clr-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          padding: 40, maxWidth: 420, textAlign: 'center',
        }}>
          <AlertTriangle size={48} color="var(--clr-danger)" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Algo salió mal</h2>
          <p style={{ color: 'var(--clr-text-light)', marginBottom: 24, fontSize: 14 }}>
            Ocurrió un error inesperado. Intenta recargar la página; si el problema persiste, contacta a soporte.
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            <RotateCcw size={16} /> Recargar página
          </button>
        </div>
      </div>
    )
  }
}
