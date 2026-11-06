import { useEffect, useMemo, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Copy, Minus, Square, X } from 'lucide-react'

export function WindowControls({ onError }: { onError: (error: unknown) => void }) {
  const appWindow = useMemo(() => getCurrentWindow(), [])
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | undefined
    const refresh = async () => {
      try {
        const value = await appWindow.isMaximized()
        if (!disposed) setMaximized(value)
      } catch (error) { if (!disposed) onError(error) }
    }
    void refresh()
    void appWindow.onResized(() => { void refresh() }).then(off => {
      if (disposed) off()
      else unlisten = off
    }).catch(error => { if (!disposed) onError(error) })
    return () => { disposed = true; unlisten?.() }
  }, [appWindow, onError])

  const run = async (action: () => Promise<void>) => {
    try { await action() } catch (error) { onError(error) }
  }
  const maximizeLabel = maximized ? 'Restaurar janela' : 'Maximizar janela'

  return <div className="window-controls" role="group" aria-label="Controles da janela">
    <button type="button" className="window-control" aria-label="Minimizar janela" title="Minimizar" onClick={() => { void run(() => appWindow.minimize()) }}><Minus size={15} strokeWidth={1.5} /></button>
    <button type="button" className="window-control" aria-label={maximizeLabel} title={maximizeLabel} onClick={() => { void run(() => appWindow.toggleMaximize()) }}>{maximized ? <Copy size={12} strokeWidth={1.5} /> : <Square size={12} strokeWidth={1.5} />}</button>
    <button type="button" className="window-control window-close" aria-label="Fechar Noetia" title="Fechar" onClick={() => { void run(() => appWindow.close()) }}><X size={16} strokeWidth={1.5} /></button>
  </div>
}
