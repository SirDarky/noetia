import { useEffect, useId, useMemo, useState } from 'react'
import { ChevronRight, FolderClosed, FolderOpen, Star } from 'lucide-react'
import { activeFolderIds, buildDocumentTree, displayPath, type DocumentFolder } from '../lib/document-tree'
import type { MarkdownDocument } from '../types'
import './document-tree.css'

const PAGE_SIZE = 5
const STORAGE_KEY = 'noetia-folder-expansion'
function restoreExpansion(): Record<string, boolean> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter(([, expanded]) => typeof expanded === 'boolean'))
  } catch { return {} }
}

export function DocumentTree({ documents, roots, activeId, favorites, query, onOpen }: {
  documents: MarkdownDocument[]; roots: string[]; activeId: string; favorites: string[]; query: string
  onOpen: (document: MarkdownDocument) => void
}) {
  const tree = useMemo(() => buildDocumentTree(documents, roots), [documents, roots])
  const [expansion, setExpansion] = useState(restoreExpansion)
  const [fullLists, setFullLists] = useState<Record<string, boolean>>({})
  const [searchClosed, setSearchClosed] = useState<Record<string, boolean>>({})
  const searching = !!query.trim()
  const treeId = useId()
  const activeFolders = useMemo(() => activeFolderIds(tree, activeId), [tree, activeId])
  const activeKey = JSON.stringify(activeFolders)
  useEffect(() => {
    const ancestors: string[] = JSON.parse(activeKey)
    if (!ancestors.length) return
    setExpansion(old => ({ ...old, ...Object.fromEntries(ancestors.map(id => [id, true])) }))
  }, [activeKey, activeId])
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(expansion)) } catch { /* Navigation still works without storage. */ }
  }, [expansion])
  useEffect(() => { setSearchClosed({}) }, [query])

  function renderFolder(folder: DocumentFolder, depth: number) {
    const open = searching ? !searchClosed[folder.id] : (expansion[folder.id] ?? (depth === 0 || activeFolders.includes(folder.id)))
    const childrenId = `${treeId}-${encodeURIComponent(folder.id)}`
    const activeIndex = folder.documents.findIndex(doc => doc.id === activeId)
    const limit = searching || fullLists[folder.id] ? folder.documents.length : Math.max(PAGE_SIZE, activeIndex + 1)
    const shown = folder.documents.slice(0, limit)
    const duplicateRoot = depth === 0 && tree.filter(root => root.name === folder.name).length > 1
    return <li className={`document-folder ${depth === 0 ? 'root-folder' : ''}`} key={folder.id}>
      <button className="folder-row" aria-label={`Pasta ${folder.name}, ${folder.count} ${folder.count === 1 ? 'documento' : 'documentos'}`} aria-expanded={open} aria-controls={childrenId} title={folder.path || 'Documentos abertos individualmente'} onClick={() => searching ? setSearchClosed(old => ({ ...old, [folder.id]: open })) : setExpansion(old => ({ ...old, [folder.id]: !open }))}>
        <ChevronRight size={12} className={`folder-chevron ${open ? 'expanded' : ''}`} />
        {open ? <FolderOpen size={15} /> : <FolderClosed size={15} />}
        <span className="folder-name"><span>{folder.name}</span>{duplicateRoot && <small>{folder.path.split('/').slice(0, -1).pop()}</small>}</span>
        <span className="folder-count" aria-hidden="true">{folder.count}</span>
      </button>
      <ul id={childrenId} className="folder-children" hidden={!open}>
        {folder.folders.map(child => renderFolder(child, depth + 1))}
        {shown.map(doc => <li key={doc.id}><button className={`document-row ${doc.id === activeId ? 'active' : ''}`} aria-current={doc.id === activeId ? 'page' : undefined} title={displayPath(doc.path)} onClick={() => onOpen(doc)}><span>{doc.name.replace(/\.(md|markdown)$/i, '')}</span>{favorites.includes(doc.id) && <Star size={11} className="filled-star" aria-label="Favorito" />}</button></li>)}
        {folder.documents.length > shown.length && <li><button className="folder-more" aria-label={`Mostrar mais ${folder.documents.length - shown.length} documentos de ${folder.name}`} onClick={() => setFullLists(old => ({ ...old, [folder.id]: true }))}>Mostrar mais <span>{folder.documents.length - shown.length}</span></button></li>}
        {!searching && fullLists[folder.id] && folder.documents.length > Math.max(PAGE_SIZE, activeIndex + 1) && <li><button className="folder-more" onClick={() => setFullLists(old => ({ ...old, [folder.id]: false }))}>Mostrar menos</button></li>}
      </ul>
    </li>
  }
  return <nav className="file-list document-tree" aria-label="Pastas e documentos">{tree.length ? <ul className="folder-roots">{tree.map(folder => renderFolder(folder, 0))}</ul> : <p className="sidebar-empty">Nenhum documento encontrado.</p>}</nav>
}
