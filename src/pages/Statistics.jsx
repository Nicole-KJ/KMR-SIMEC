import { BarChart3 } from 'lucide-react'
import { useReports } from '../hooks/useReports'
import ReportStatsPanel from '../components/ReportStatsPanel'

export default function Statistics() {
  const { reports, loading, error, reload } = useReports()

  return (
    <div className="content-wrapper fade-in">
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:22, fontWeight:800 }}><BarChart3 size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />Estadísticas</h1>
        <p style={{ color:'var(--clr-text-light)', fontSize:13, marginTop:4 }}>Panel de gestión · resumen de actividad</p>
      </div>
      <ReportStatsPanel reports={reports} loading={loading} error={error} onRetry={reload} />
    </div>
  )
}
