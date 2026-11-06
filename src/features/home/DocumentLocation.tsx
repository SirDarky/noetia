import { ChevronRight, FolderOpen } from 'lucide-react'
import { displayPath } from '../../lib/document-tree'
import { documentBreadcrumbs } from '../reader/workspace-model'
import type { MarkdownDocument } from '../../types'

export function DocumentLocation({ doc, roots }: { doc: MarkdownDocument; roots: string[] }) {
  const folders = documentBreadcrumbs(doc, roots)
  const root = folders[0]?.name ?? 'Arquivos avulsos'
  const trail = folders.length > 4 ? [{ name: '…', path: '' }, ...folders.slice(-2)] : folders.slice(1)

  return <span className="collection-location" title={displayPath(doc.path)} aria-label={`Localização: ${folders.map(folder => folder.name).join(' / ') || root}`}>
    <span className="location-root"><FolderOpen size={11} aria-hidden="true" /><span>{root}</span></span>
    {trail.map((folder, index) => <span className="location-step" key={folder.path || index}><ChevronRight size={10} aria-hidden="true" /><span>{folder.name}</span></span>)}
  </span>
}
