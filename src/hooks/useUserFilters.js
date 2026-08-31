import { useState } from 'react'

export const ROLE_OPTIONS = [
  { value: 'tecnico', label: 'Técnico' },
  { value: 'admin', label: 'Administrador' },
]

export const STATUS_OPTIONS = [
  { value: 'active', label: 'Activo' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'banned', label: 'Deshabilitado' },
]

// Accent-insensitive so "jose" matches "José" -- a search box shouldn't
// require typing accents. Plain toLowerCase() alone won't fold é -> e.
// Same convention as useReportFilters' foldAccents.
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')
const foldAccents = s => (s || '').normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase()

// Mirrors what AdminUsers' table renders per row (Correo, Nombre) so a
// search term matches only what's actually visible in that row.
function userSearchText(u) {
  return [u.email, u.full_name].filter(Boolean).map(foldAccents).join(' ')
}

// Search/rol/estado filter set over the Usuarios list (AdminUsers.jsx).
export function useUserFilters(users) {
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const hasActiveFilters = !!(searchQuery || roleFilter || statusFilter)

  function clearFilters() {
    setSearchQuery(''); setRoleFilter(''); setStatusFilter('')
  }

  const filteredUsers = users.filter(u => {
    if (searchQuery && !userSearchText(u).includes(foldAccents(searchQuery))) return false
    if (roleFilter && u.role !== roleFilter) return false
    if (statusFilter === 'active' && (u.banned || u.pending)) return false
    if (statusFilter === 'pending' && !u.pending) return false
    if (statusFilter === 'banned' && !u.banned) return false
    return true
  })

  return {
    searchQuery, setSearchQuery,
    roleFilter, setRoleFilter,
    statusFilter, setStatusFilter,
    hasActiveFilters, clearFilters, filteredUsers,
  }
}
