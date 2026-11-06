import { AnimatedAsciiBackdrop } from './AnimatedAsciiBackdrop'

export function SidebarArtwork({ theme, compact = false }: { theme: string; compact?: boolean }) {
  return <div className={`sidebar-artwork ${compact ? 'compact' : ''}`} aria-hidden="true">
    <AnimatedAsciiBackdrop src="/assets/witch-reading.png" motion={false} theme={theme} preview />
    <div className="sidebar-artwork-fade" />
  </div>
}
