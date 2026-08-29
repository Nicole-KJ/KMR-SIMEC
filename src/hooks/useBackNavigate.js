import { useNavigate, useLocation } from 'react-router-dom'

// Back arrows (icon-btn + ArrowLeft) normally return real browser history --
// navigate(-1) takes the user to whatever view they were actually on before.
//
// The one case that breaks: someone opens a direct/shared link (e.g. a
// report's URL) while logged out. PrivateRoute (App.jsx) bounces them to
// /login carrying that destination, and Login.jsx sends them back to it on
// success -- but that landing page has no real "previous view" in this
// browser session to go back to (history only has /login, itself just
// replacing whatever they had before opening the link at all). Login marks
// that landing navigation with state.fromLogin so this hook can send the
// back arrow to `fallback` (the dashboard by default) instead of stepping
// into a dead end.
export function useBackNavigate(fallback = '/dashboard') {
  const navigate = useNavigate()
  const location = useLocation()
  return () => {
    if (location.state?.fromLogin) navigate(fallback, { replace: true })
    else navigate(-1)
  }
}
