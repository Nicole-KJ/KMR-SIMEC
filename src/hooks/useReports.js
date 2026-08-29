import { useState, useEffect, useCallback } from 'react'
import { getReports, getAllReports, getClientReports } from '../services/supabaseDB'
import { useAuth } from '../contexts/AuthContext'
import { logError } from '../utils/logger'

export function useReports() {
  const { user, isAdmin, isClient } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    if (!user) return
    setLoading(true)
    setError(null)
    const fetchReports = isAdmin ? getAllReports() : isClient ? getClientReports(user.id) : getReports()
    fetchReports
      .then(data => setReports(data))
      .catch(err => {
        logError('useReports', err)
        setError(err)
      })
      .finally(() => setLoading(false))
  }, [user, isAdmin, isClient])

  useEffect(() => { load() }, [load])

  return { reports, loading, error, reload: load }
}
