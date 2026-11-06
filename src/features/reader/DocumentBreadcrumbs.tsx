import { useMemo, useState } from 'react'
import { Popover } from 'radix-ui'
import { ChevronRight, FolderOpen, Orbit, Search, X } from 'lucide-react'
import { documentBreadcrumbs, folderContains } from './workspace-model'
import { indexReferences, documentExcerpt } from '../universes/model'
import { searchDocuments } from '../../lib/documents'
import type { MarkdownDocument } from '../../types'
import './workspace.css'

function FolderUniverse({ path, name, docs, activeId, onOpen }: { path: string; name: string; docs: MarkdownDocument[]; activeId: string; onOpen: (doc: MarkdownDocument) => void }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState('')
  const scoped = useMemo(() => docs.filter(doc => folderContains(path, doc.path)), [docs, path])
  const matching = useMemo(() => searchDocuments(scoped, query), [scoped, query])
  const nodes = matching.slice(0, 24)
  const connections = useMemo(() => {
    if (!open) return []
    let budget = 256_000
    const indexed = matching.slice(0, 24).map(doc => { const include = doc.content.length <= Math.min(128_000, budget); if (include) budget -= doc.content.length; return include ? doc : { ...doc, content: '' } })
    return indexReferences(indexed).filter(ref => ref.status === 'resolved' && ref.targetId)
  }, [open, matching])
  const points = nodes.map((_, i) => ({ x: 50 + Math.cos(i * 2.399) * (nodes.length === 1 ? 0 : 12 + Math.sqrt(i / Math.max(1, nodes.length - 1)) * 30), y: 50 + Math.sin(i * 2.399) * (nodes.length === 1 ? 0 : 12 + Math.sqrt(i / Math.max(1, nodes.length - 1)) * 30) }))
  const choose = (doc: MarkdownDocument) => { setOpen(false); onOpen(doc) }
  return <Popover.Root open={open} onOpenChange={value => { setOpen(value); if (!value) setQuery('') }}><Popover.Trigger asChild><button className="breadcrumb-folder" title={path} aria-label={`Explorar pasta ${name}`}>{name}</button></Popover.Trigger><Popover.Portal><Popover.Content className="folder-universe-popover" align="start" sideOffset={12} collisionPadding={16} aria-label={`Universo da pasta ${name}`}>
    <header><span className="mini-orbit"><Orbit size={19} /></span><div><strong>{name}</strong><small>{scoped.length} notas neste universo</small></div><Popover.Close aria-label="Fechar universo da pasta"><X size={15} /></Popover.Close></header>
    <label className="folder-universe-search"><Search size={14} /><input aria-label={`Buscar notas em ${name}`} value={query} onChange={event => setQuery(event.target.value)} placeholder="Encontrar uma nota…" /></label>
    <div className="folder-universe-map" role="group" aria-label="Mapa de notas"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{connections.map((ref, index) => { const from = nodes.findIndex(doc => doc.id === ref.sourceId), to = nodes.findIndex(doc => doc.id === ref.targetId); return from >= 0 && to >= 0 ? <line key={index} x1={points[from].x} y1={points[from].y} x2={points[to].x} y2={points[to].y} /> : null })}</svg>{nodes.map((doc, index) => <button key={doc.id} className={`mini-star ${doc.id === activeId ? 'current' : ''}`} style={{ left: `${points[index].x}%`, top: `${points[index].y}%` }} aria-label={`Abrir ${doc.name} no mapa`} title={`${doc.name}\n${documentExcerpt(doc.content.slice(0, 4000))}`} onClick={() => choose(doc)}><span aria-hidden="true">✦</span><small>{doc.name.replace(/\.(md|markdown)$/i, '')}</small></button>)}{!nodes.length && <p>Nenhuma nota encontrada.</p>}</div>
    <div className="folder-universe-notes" aria-label="Notas da pasta">{matching.map(doc => <button key={doc.id} onClick={() => choose(doc)} title={doc.path} aria-current={doc.id === activeId ? 'page' : undefined}><span className="mini-note-dot" /><span>{doc.name}</span><ChevronRight size={12} /></button>)}</div>
    <footer>{matching.length > 24 ? 'O mapa mostra 24 notas. Todas estão na lista abaixo.' : 'Cada estrela abre uma nota. Linhas representam links reais.'}</footer><Popover.Arrow className="folder-universe-arrow" /></Popover.Content></Popover.Portal></Popover.Root>
}
export function DocumentBreadcrumbs({ doc, roots, docs, onOpen }: { doc: MarkdownDocument; roots: string[]; docs: MarkdownDocument[]; onOpen: (doc: MarkdownDocument) => void }) {
  const segments = documentBreadcrumbs(doc, roots)
  return <nav className="note-breadcrumbs" aria-label="Caminho do documento"><FolderOpen size={14} aria-hidden="true" />{segments.map(segment => <span key={segment.path}><FolderUniverse path={segment.path} name={segment.name} docs={docs} activeId={doc.id} onOpen={onOpen} /><ChevronRight size={11} aria-hidden="true" /></span>)}<strong title={doc.name} aria-current="page">{doc.name}</strong></nav>
}
