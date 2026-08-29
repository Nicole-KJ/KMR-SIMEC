import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import logo from '../assets/brand/logo.png'

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(err.message ?? 'No se pudo enviar el correo de recuperación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card fade-in">
        <div className="login-logo">
          <div className="login-logo-badge">
            <img src={logo} alt="K Maintenance Report" />
          </div>
          <h1>Recuperar Contraseña</h1>
          <p>Te enviaremos un enlace para restablecerla</p>
        </div>

        {sent ? (
          <div style={{
            background: 'var(--clr-success-bg)', border: '1.5px solid var(--clr-success)',
            borderRadius: 'var(--radius-md)', padding: '14px 16px',
            marginBottom: 20, fontSize: 14, display: 'flex', gap: 10, alignItems: 'flex-start'
          }}>
            <CheckCircle size={18} color="var(--clr-success)" style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ color: 'var(--clr-success)' }}>
              Si existe una cuenta con el correo <strong>{email}</strong>, recibirás un enlace para restablecer tu contraseña en unos minutos.
            </span>
          </div>
        ) : (
          <>
            {error && (
              <div style={{
                background: 'var(--clr-danger-bg)', color: 'var(--clr-danger)',
                padding: '12px 16px', borderRadius: 'var(--radius-md)',
                marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center',
                fontSize: 14, fontWeight: 500
              }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Correo electrónico <span>*</span></label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="tecnico@ejemplo.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <button type="submit" className="btn btn-primary btn-block btn-lg"
                disabled={loading} style={{ marginTop: 8 }}>
                {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </button>
            </form>
          </>
        )}

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13 }}>
          <Link to="/login" style={{ color: 'var(--clr-primary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={14} /> Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
