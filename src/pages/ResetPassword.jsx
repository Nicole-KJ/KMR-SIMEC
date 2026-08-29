import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle, CheckCircle, Loader } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import logo from '../assets/brand/logo.png'

// Recovery/invite links land here as `#access_token=...&refresh_token=...`.
function parseTokensFromHash() {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
  const params = new URLSearchParams(hash)
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  return access_token && refresh_token ? { access_token, refresh_token } : null
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const { updatePassword, signOut } = useAuth()
  // The tokens from the URL are the one unambiguous source of truth for
  // "which account is this". Session state read from getSession()/ambient
  // auth events isn't reliable here: if a different account is already
  // logged in elsewhere in the same browser, that tab's background token
  // refresh can overwrite this session in localStorage between page load
  // and form submit, silently updating the WRONG account's password.
  const tokensRef = useRef(null)

  const [checking, setChecking] = useState(true)
  const [validLink, setValidLink] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const tokens = parseTokensFromHash()
    tokensRef.current = tokens

    // Drop the tokens from the visible URL/history once captured.
    if (tokens) window.history.replaceState(null, '', window.location.pathname)

    ;(async () => {
      if (tokens) {
        const { error: sessionErr } = await supabase.auth.setSession(tokens)
        setValidLink(!sessionErr)
      } else {
        // No tokens in the URL (e.g. page reloaded after they were already
        // stripped) — fall back to whatever session already exists.
        const { data: { session } } = await supabase.auth.getSession()
        setValidLink(!!session)
      }
      setChecking(false)
    })()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return }

    setSaving(true)
    try {
      // Re-assert the session from this link's own tokens immediately
      // before the write, closing the cross-tab race described above to a
      // single round trip instead of the whole time the user spent typing.
      if (tokensRef.current) {
        const { error: sessionErr } = await supabase.auth.setSession(tokensRef.current)
        if (sessionErr) throw sessionErr
      }
      await updatePassword(password)
      // Sign out and require a fresh login rather than continuing on this
      // session — simpler to reason about, and matches expected behavior.
      await signOut()
      setDone(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.message ?? 'Error al actualizar la contraseña')
    } finally {
      setSaving(false)
    }
  }

  if (checking) return (
    <div className="login-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader size={32} className="spin" color="white" />
      </div>
    </div>
  )

  if (!validLink) return (
    <div className="login-page">
      <div className="login-card fade-in" style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 40, marginBottom: 16 }}>⚠️</p>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Enlace inválido o expirado</h2>
        <p style={{ color: 'var(--clr-text-light)', marginBottom: 24 }}>
          Este enlace de recuperación ya no es válido. Solicita uno nuevo.
        </p>
        <Link to="/recuperar-contrasena" className="btn btn-primary btn-block btn-lg">
          Solicitar nuevo enlace
        </Link>
      </div>
    </div>
  )

  if (done) return (
    <div className="login-page">
      <div className="login-card fade-in" style={{ textAlign: 'center' }}>
        <CheckCircle size={64} color="var(--clr-success)" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>¡Contraseña actualizada!</h2>
        <p style={{ color: 'var(--clr-text-light)' }}>Redirigiendo a iniciar sesión...</p>
      </div>
    </div>
  )

  return (
    <div className="login-page">
      <div className="login-card fade-in">
        <div className="login-logo">
          <div className="login-logo-badge">
            <img src={logo} alt="K Maintenance Report" />
          </div>
          <h1>Nueva Contraseña</h1>
          <p>Elige una contraseña segura para tu cuenta</p>
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
            <label className="form-label">Nueva contraseña <span>*</span></label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                style={{ paddingRight: 44 }}
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--clr-text-light)'
                }}>
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Confirmar contraseña <span>*</span></label>
            <input
              type={showPw ? 'text' : 'password'}
              className="form-control"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block btn-lg"
            disabled={saving} style={{ marginTop: 8 }}>
            {saving ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
