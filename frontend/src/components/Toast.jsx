import { createContext, useCallback, useContext, useState } from 'react'
import { Check, WifiOff } from 'lucide-react'

const ToastCtx = createContext(() => {})

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const mostrar = useCallback((texto, tipo = 'ok') => {
    const id = Date.now()
    setToast({ id, texto, tipo })
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 3800)
  }, [])
  return (
    <ToastCtx.Provider value={mostrar}>
      {children}
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast.tipo === 'cola' ? <WifiOff size={16} /> : <Check size={16} />}
          {toast.texto}
        </div>
      )}
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)
