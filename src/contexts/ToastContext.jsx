import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

const ToastContext = createContext(null)
const ICONS = { success: CheckCircle, error: XCircle, warning: AlertTriangle }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((message, type = 'error') => {
    const id = ++idRef.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => {
          const Icon = ICONS[t.type] ?? XCircle
          return (
            <div key={t.id} className={`toast ${t.type}`} onClick={() => dismiss(t.id)}>
              <Icon size={16} />
              <span>{t.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
