import type { CSSProperties } from 'react'
import { Check, Palette } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog'
import { themes, type ThemeId } from '../../lib/themes'

export function ThemeOptions({ value, onChange }: { value: ThemeId; onChange: (id: ThemeId) => void }) {
  return <div className="theme-options" role="group" aria-label="Temas disponíveis">{themes.map(theme => <button
    key={theme.id} aria-label={`Usar tema ${theme.name}`} aria-pressed={value === theme.id}
    className={`theme-option ${value === theme.id ? 'selected' : ''}`} onClick={() => onChange(theme.id)}
    style={{ '--preview-background': theme.palette.background, '--preview-card': theme.palette.card, '--preview-ink': theme.palette.foreground, '--preview-accent': theme.palette.primary } as CSSProperties}>
    <span className="theme-preview" aria-hidden="true"><span /><i /><i /><b /></span>
    <span className="theme-details"><strong>{theme.name}</strong><small>{theme.description}</small></span>
    {value === theme.id && <Check size={15} />}
  </button>)}</div>
}

export function ThemePicker({ value, onChange }: { value: ThemeId; onChange: (id: ThemeId) => void }) {
  return <Dialog><DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Escolher tema" title="Escolher tema"><Palette size={17} /></Button></DialogTrigger>
    <DialogContent className="theme-dialog"><DialogHeader><DialogTitle>Outra atmosfera.</DialogTitle><DialogDescription>Escolha as cores do seu espaço. A arte acompanha cada tema.</DialogDescription></DialogHeader>
      <ThemeOptions value={value} onChange={onChange} /><p className="theme-note">Sua escolha fica salva neste dispositivo.</p>
    </DialogContent>
  </Dialog>
}
