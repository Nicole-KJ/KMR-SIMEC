import { useState, useEffect, useCallback } from 'react'
import { listClients } from '../services/clientUsersService'
import { getUnlinkedReportClients } from '../services/supabaseDB'
import { listUsers } from '../services/adminUsersService'
import { useAuth } from '../contexts/AuthContext'
import { logError } from '../utils/logger'

// Shared by Clientes.jsx (the directory list) and ClienteDetail.jsx (a
// single row's detail view) so both build the exact same merged identity:
// portal "cliente" accounts (linked: true, id = profile id) plus free-text
// names typed on a report that were never tied to a portal account
// (linked: false, id `unlinked:<name>`) -- see get_unlinked_report_clients
// (023). ClienteDetail matches a row by this same id, so the two must stay
// in sync.
export function useClientsDirectory() {
  const { isAdmin } = useAuth()
  const [clients, setClients] = useState([])
  const [existingEmails, setExistingEmails] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // listUsers() covers every role (admin/técnico/cliente), not just
      // clients -- needed so "Invitar" doesn't offer an email that's
      // already taken by a non-client account. Admin-only server-side, so
      // only fetch it as one.
      const [portalClients, unlinkedClients, allUsers] = await Promise.all([
        listClients(),
        getUnlinkedReportClients(),
        isAdmin ? listUsers() : Promise.resolve([]),
      ])
      setExistingEmails(new Set(
        [...portalClients, ...allUsers].map(u => u.email?.toLowerCase()).filter(Boolean)
      ))
      const merged = [
        ...portalClients.map(c => ({ ...c, linked: true })),
        ...unlinkedClients.map(c => ({
          id: `unlinked:${c.client_name}`,
          email: c.client_email,
          full_name: c.client_name,
          address: c.client_address,
          banned: null,
          last_sign_in_at: null,
          linked: false,
        })),
      ].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
      setClients(merged)
    } catch (err) {
      logError('useClientsDirectory', err)
      setError(err.message ?? 'Error al cargar clientes')
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => { load() }, [load])

  return { clients, setClients, existingEmails, loading, error, reload: load }
}
