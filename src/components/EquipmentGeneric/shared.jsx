export function MeasurementItem({ label, value }) {
  return (
    <div className="detail-measurement-item">
      <div className="dm-label">{label}</div>
      <div className={`dm-value ${!value ? 'empty' : ''}`}>{value || '—'}</div>
    </div>
  )
}

export function ChecklistItem({ done, label }) {
  return (
    <div className={`detail-checklist-item ${done ? 'done' : 'pending'}`}>
      <span className="dci-icon">{done ? '✅' : '❌'}</span>
      <span className="dci-text">{label}</span>
    </div>
  )
}
