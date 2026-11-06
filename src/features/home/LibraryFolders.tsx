import { useEffect, useState } from 'react'
import { ChevronRight, Folder, FolderOpen } from 'lucide-react'
import type { DocumentFolder } from '../../lib/document-tree'
import { folderTrail } from './collection-model'

export function LibraryFolders({ tree, selectedId, onSelect }: {
  tree: DocumentFolder[]; selectedId: string | null; onSelect: (id: string) => void
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  useEffect(() => {
    const trail = folderTrail(tree, selectedId)
    if (trail.length) setExpanded(old => ({ ...old, ...Object.fromEntries(trail.map(folder => [folder.id, true])) }))
  }, [tree, selectedId])
  const toggle = (id: string) => setExpanded(old => ({ ...old, [id]: !old[id] }))
  const render = (folders: DocumentFolder[]) => <ul>{folders.map(folder => <li key={folder.id}>
    <div className={`home-folder-row ${selectedId === folder.id ? 'selected' : ''}`}>
      {folder.folders.length > 0 ? <button className="home-folder-toggle" aria-label={`${expanded[folder.id] ? 'Recolher' : 'Expandir'} ${folder.name}`} aria-expanded={!!expanded[folder.id]} onClick={() => toggle(folder.id)}><ChevronRight size={12} /></button> : <span className="home-folder-spacer" />}
      <button className="home-folder-select" aria-label={`Ver documentos de ${folder.name}`} aria-current={selectedId === folder.id ? 'page' : undefined} title={folder.path || folder.name} onClick={() => { onSelect(folder.id); setExpanded(old => ({ ...old, [folder.id]: true })) }}>
        {expanded[folder.id] ? <FolderOpen size={14} /> : <Folder size={14} />}<span>{folder.name}</span><small>{folder.count}</small>
      </button>
    </div>
    {expanded[folder.id] && folder.folders.length > 0 && render(folder.folders)}
  </li>)}</ul>
  return <nav className="home-folder-tree" aria-label="Pastas adicionadas">{render(tree)}</nav>
}
