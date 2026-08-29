import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { getPublicBranding } from '../services/supabaseDB'
import { logError } from '../utils/logger'
import logo from '../assets/brand/logo.png'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [branding, setBranding] = useState(null)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    getPublicBranding().catch(err => { logError('Login.getPublicBranding', err); return null }).then(setBranding)
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError('Correo o contraseña incorrectos. Verifica tus datos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card fade-in">
        <div className="login-logo">
          <div className="login-logo-badge">
            <img src={branding?.logo_url || logo} alt="K Maintenance Report" />
          </div>
          {/* The logo image already renders the wordmark — this heading exists for accessibility/SEO without repeating it visually. */}
          <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>K Maintenance Report</h1>
          <p>{branding?.company_name || 'Sistema de Informes de Servicio Técnico'}</p>
        </div>

        {/* Supabase connected indicator */}
        <div style={{
          background: 'var(--clr-success-bg)', border: '1.5px solid var(--clr-success)',
          borderRadius: 'var(--radius-md)', padding: '10px 14px',
          marginBottom: 20, fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          <span style={{ fontSize: 16 }}>✅</span>
          <span style={{ color: 'var(--clr-success)', fontWeight: 600 }}>Conectado · Base de datos activa</span>
        </div>

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
              id="login-email"
              type="email"
              className="form-control"
              placeholder="tecnico@ejemplo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contraseña <span>*</span></label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ paddingRight: 44 }}
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                style={{
                  position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', cursor:'pointer', color:'var(--clr-text-light)'
                }}>
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button id="login-submit" type="submit" className="btn btn-primary btn-block btn-lg"
            disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
            <Link to="/recuperar-contrasena" style={{ color: 'var(--clr-primary)' }}>
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
        </form>

        <p style={{ textAlign:'center', marginTop:24, fontSize:12, color:'var(--clr-text-light)' }}>
          K Maintenance Report
        </p>
      </div>
    </div>
  )
}
