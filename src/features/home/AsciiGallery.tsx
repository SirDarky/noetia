import { useState } from 'react'
import { Check, Palette } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog'
import { AnimatedAsciiBackdrop } from './AnimatedAsciiBackdrop'
import { artworks, getArtwork, type AsciiArtId } from './artworks'
import { ASCII_RENDERING_ENABLED } from './renderingPolicy'

export function AsciiGallery({ value, theme, onChange, compact = false }: { value: AsciiArtId; theme: string; onChange: (id: AsciiArtId) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  if (!ASCII_RENDERING_ENABLED) return <Button variant={compact ? 'ghost' : 'outline'} size={compact ? 'icon' : 'default'} disabled aria-label="Arte ASCII temporariamente pausada" title="Arte ASCII temporariamente pausada"><Palette size={15} />{!compact && 'Arte pausada'}</Button>
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button className={compact ? 'art-gallery-trigger' : ''} variant={compact ? 'ghost' : 'outline'} size={compact ? 'icon' : 'default'} aria-label="Trocar arte ASCII" title="Trocar arte ASCII"><Palette size={15} />{!compact && getArtwork(value).name}</Button></DialogTrigger>
    <DialogContent className="ascii-gallery-dialog"><DialogHeader><DialogTitle>Seu espaço, outra perspectiva.</DialogTitle><DialogDescription>Escolha uma arte para a biblioteca. O movimento é suave e independente do mouse.</DialogDescription></DialogHeader>
      <div className="ascii-gallery-grid">{artworks.map(art => <button key={art.id} className={`ascii-art-option ${value === art.id ? 'selected' : ''}`} aria-label={`Usar ASCII ${art.name}`} aria-pressed={value === art.id} onClick={() => { onChange(art.id); setOpen(false) }}>
        <div className="ascii-art-preview"><AnimatedAsciiBackdrop src={art.src} motion={false} theme={theme} preview /></div>
        <div className="ascii-art-details"><span><strong>{art.name}</strong><small>ESTUDO {art.study}</small></span>{value === art.id && <Check size={15} />}</div>
      </button>)}</div>
      <p className="ascii-gallery-note">Sua escolha fica salva neste dispositivo. Ajuste o movimento nas preferências.</p>
    </DialogContent>
  </Dialog>
}
