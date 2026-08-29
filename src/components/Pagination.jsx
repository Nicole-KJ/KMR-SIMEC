import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20 }}>
      <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft size={14} /> Anterior
      </button>
      <span style={{ fontSize: 13, color: 'var(--clr-text-light)' }}>Página {page} de {totalPages}</span>
      <button className="btn btn-secondary btn-sm" disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>
        Siguiente <ChevronRight size={14} />
      </button>
    </div>
  )
}
