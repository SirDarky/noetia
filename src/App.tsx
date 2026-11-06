import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { BookOpen, FolderOpen, FileText, ArrowUpRight, Search, Star, Settings2, Sparkles, ChevronRight, X, PanelLeftClose, PanelLeftOpen, Clock3, Plus, Check, Library, ArrowRight, Orbit } from 'lucide-react'
import { Button } from './components/ui/button'
import { WindowControls } from './components/WindowControls'
import { DocumentTree } from './components/DocumentTree'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from './components/ui/dialog'
import { AnimatedAsciiBackdrop } from './features/home/AnimatedAsciiBackdrop'
import { AsciiGallery } from './features/home/AsciiGallery'
import { DocumentLocation } from './features/home/DocumentLocation'
import { LibraryFolders } from './features/home/LibraryFolders'
import { collectionDocuments, collectionOrders, folderTrail, type CollectionFilter, type CollectionOrder } from './features/home/collection-model'
import { activeFolderIds, buildDocumentTree } from './lib/document-tree'
import { SidebarArtwork } from './features/home/SidebarArtwork'
import { ThemeOptions, ThemePicker } from './features/home/ThemePicker'
import { ASCII_RENDERING_ENABLED } from './features/home/renderingPolicy'
import { getArtwork } from './features/home/artworks'
import { DocumentBreadcrumbs } from './features/reader/DocumentBreadcrumbs'
import { volatileDrafts, volatileDraftMessage } from './features/reader/draft-session'
import { ReaderWorkspace } from './features/reader/ReaderWorkspace'
import { UniverseWorkspace } from './features/universes/UniverseWorkspace'
import { resolveReference, wikiPrefix, type NoteReference } from './features/universes/model'
import { headingId } from './lib/documents'
import { documentStats, searchDocuments } from './lib/documents'
import { applyTheme, getTheme } from './lib/themes'
import { importDropped, libraryRoots, native, resolveDocument, restoreLibrary, selectDocuments } from './services/files'
import { emptySession, type MarkdownDocument, type Preferences, type Session } from './types'
import { sample } from './sample'

function readStored<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? { ...fallback, ...JSON.parse(value) } : fallback } catch { return fallback }
}
export default function App() {
  const [docs, setDocs] = useState<MarkdownDocument[]>([sample])
  const [roots, setRoots] = useState<string[]>([])
  const [session, setSession] = useState<Session>(() => readStored('noetia-session', emptySession))
  const [prefs, setPrefs] = useState<Preferences>(() => readStored<Preferences>('noetia-preferences', { theme: 'dark', motion: true, readingWidth: 'comfortable', asciiArt: 'witch' }))
  const artwork = getArtwork(prefs.asciiArt), theme = getTheme(prefs.theme)
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false)
  const [query, setQuery] = useState(''), [toast, setToast] = useState(''), [sidebar, setSidebar] = useState(true)
  const [toc, setToc] = useState<{ id: string; text: string; level: number }[]>([])
  const [favoriteOnly, setFavoriteOnly] = useState(false), [dragging, setDragging] = useState(false)
  const [homeFilter, setHomeFilter] = useState<CollectionFilter>('all')
  const [homeFolder, setHomeFolder] = useState<string | null>(null)
  const [homeOrder, setHomeOrder] = useState<CollectionOrder>('name')
  const [homeView, setHomeView] = useState<'library' | 'universes'>('library')
  const [referenceLocation, setReferenceLocation] = useState<NoteReference | null>(null)
  const articleRef = useRef<HTMLElement>(null), searchRef = useRef<HTMLInputElement>(null), tabsRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef(session); sessionRef.current = session
  const active = docs.find(doc => doc.id === session.active)
  const visible = searchDocuments(docs, query).filter(doc => !favoriteOnly || session.favorites.includes(doc.id))
  const userDocs = useMemo(() => docs.filter(doc => doc.id !== sample.id), [docs])
  const folders = useMemo(() => buildDocumentTree(userDocs, roots), [userDocs, roots])
  const selectedTrail = useMemo(() => folderTrail(folders, homeFolder), [folders, homeFolder])
  const selectedFolder = selectedTrail.at(-1)
  const homeDocs = useMemo(() => collectionDocuments(userDocs, { query, filter: homeFilter, order: homeOrder,
    favorites: session.favorites, recent: session.recent, folder: selectedFolder }),
    [userDocs, query, homeFilter, homeOrder, session.favorites, session.recent, selectedFolder])
  const report = useCallback((error: unknown) => setToast(error instanceof Error ? error.message : String(error)), [])

  useEffect(() => {
    let stopped = false
    Promise.all([restoreLibrary(), libraryRoots()]).then(([library, sourceRoots]) => {
      if (stopped) return
      setRoots(sourceRoots)
      const all = [sample, ...library.filter(doc => doc.id !== sample.id)]
      setDocs(all)
      const available = new Set(all.map(doc => doc.id))
      setSession(old => ({ ...old, tabs: old.tabs.filter(id => available.has(id)), active: old.active && available.has(old.active) ? old.active : null }))
    }).catch(report).finally(() => { if (!stopped) setReady(true) })
    return () => { stopped = true }
  }, [report])
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (volatileDrafts.size) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', protect)
    let disposed = false
    let unlisten: (() => void) | undefined
    if (native) void getCurrentWindow().onCloseRequested(event => {
      if (volatileDrafts.size) { event.preventDefault(); report(new Error(volatileDraftMessage)) }
    }).then(off => { if (disposed) off(); else unlisten = off }).catch(report)
    return () => { disposed = true; unlisten?.(); window.removeEventListener('beforeunload', protect) }
  }, [report])
  useEffect(() => { applyTheme(prefs.theme); localStorage.setItem('noetia-preferences', JSON.stringify({ ...prefs, theme: getTheme(prefs.theme).id })) }, [prefs])
  useEffect(() => { if (ready) localStorage.setItem('noetia-session', JSON.stringify(session)) }, [session, ready])
  useEffect(() => { tabsRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }, [active?.id, session.tabs.length])
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 6000); return () => clearTimeout(timer) }, [toast])

  const mergeDocs = useCallback((incoming: MarkdownDocument[]) => {
    setDocs(old => { const map = new Map(old.map(doc => [doc.id, doc])); incoming.forEach(doc => map.set(doc.id, doc)); return [...map.values()] })
  }, [])
  const openDoc = useCallback((doc: MarkdownDocument) => {
    mergeDocs([doc])
    setSession(old => ({ ...old, active: doc.id, tabs: old.tabs.includes(doc.id) ? old.tabs : [...old.tabs, doc.id], recent: [doc.id, ...old.recent.filter(id => id !== doc.id)].slice(0, 12) }))
  }, [mergeDocs])
  const pick = useCallback(async (folder = false) => {
    if (busy) return
    setBusy(true)
    try {
      const incoming = await selectDocuments(folder)
      mergeDocs(incoming)
      if (incoming.length) {
        const sourceRoots = await libraryRoots()
        setRoots(sourceRoots)
        if (folder) {
          setHomeFolder(activeFolderIds(buildDocumentTree(incoming, sourceRoots), incoming[0].id)[0] ?? null)
          setHomeFilter('all'); setQuery(''); setHomeView('library')
          setSession(old => ({ ...old, active: null }))
          setToast(`${incoming.length} documentos adicionados à biblioteca.`)
        } else openDoc(incoming[0])
      }
    } catch (error) { report(error) } finally { setBusy(false) }
  }, [busy, mergeDocs, openDoc, report])
  const closeTab = useCallback((id: string) => setSession(old => {
    const index = old.tabs.indexOf(id), tabs = old.tabs.filter(tab => tab !== id)
    return { ...old, tabs, active: old.active === id ? tabs[Math.max(0, index - 1)] ?? null : old.active }
  }), [])
  const toggleFavorite = (id: string) => setSession(old => ({ ...old, favorites: old.favorites.includes(id) ? old.favorites.filter(value => value !== id) : [...old.favorites, id] }))

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      if (event.key.toLowerCase() === 'o') { event.preventDefault(); void pick(event.shiftKey) }
      if (event.key.toLowerCase() === 'k') { event.preventDefault(); setSidebar(true); setTimeout(() => searchRef.current?.focus(), 0) }
      if (event.key.toLowerCase() === 'w' && sessionRef.current.active) { event.preventDefault(); closeTab(sessionRef.current.active) }
    }
    window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut)
  }, [pick, closeTab])
  useEffect(() => {
    if (!native) return
    let stopped = false, unlisten: (() => void) | undefined
    getCurrentWindow().onDragDropEvent(async event => {
      if (event.payload.type === 'enter' || event.payload.type === 'over') setDragging(true)
      else setDragging(false)
      if (event.payload.type === 'drop') {
        try {
          const incoming = await invoke<MarkdownDocument[]>('open_dropped', { paths: event.payload.paths })
          if (!stopped) { mergeDocs(incoming); if (incoming[0]) openDoc(incoming[0]); const sourceRoots = await libraryRoots(); if (!stopped) setRoots(sourceRoots) }
        } catch (error) { if (!stopped) report(error) }
      }
    }).then(off => { if (stopped) off(); else unlisten = off }).catch(report)
    return () => { stopped = true; unlisten?.() }
  }, [mergeDocs, openDoc, report])
  useEffect(() => {
    if (!active) { setToc([]); return }
    const container = articleRef.current!
    const frame = requestAnimationFrame(() => {
      setToc([...container.querySelectorAll('h1,h2,h3')].map(node => ({ id: node.id, text: node.textContent ?? '', level: Number(node.tagName.slice(1)) })))
      container.scrollTop = sessionRef.current.positions[active.id] ?? 0
    })
    return () => cancelAnimationFrame(frame)
  }, [active?.id, active?.content])
  useEffect(() => {
    if (!native || !active || active.id === sample.id) return
    let stopped = false, missingReported = false
    const refresh = async () => {
      if (document.hidden) return
      try {
        const next = await invoke<MarkdownDocument>('read_document', { path: active.path })
        if (!stopped && next.content !== active.content) { mergeDocs([next]); setToast('Documento atualizado a partir do arquivo salvo.') }
      } catch (error) { if (!stopped && !missingReported) { report(error); missingReported = true } }
    }
    const timer = setInterval(refresh, 3000)
    return () => { stopped = true; clearInterval(timer) }
  }, [active, mergeDocs, report])

  const handleLink = async (href: string) => {
    if (!active) return
    try {
      if (href.startsWith(wikiPrefix)) {
        const target = resolveReference(active, decodeURIComponent(href.slice(wikiPrefix.length)), 'wiki', docs)
        if (!target.targetId) throw new Error(target.status === 'ambiguous' ? 'Nome ambíguo. Escolha o destino pelo painel de referências dos universos.' : 'Esta nota ainda não está cadastrada na biblioteca.')
        openDoc(docs.find(doc => doc.id === target.targetId)!)
        if (target.fragment) setTimeout(() => (document.getElementById(target.fragment) ?? document.getElementById(headingId(target.fragment, new Map())))?.scrollIntoView(), 100)
        return
      }
      const doc = await resolveDocument(active, href, docs); openDoc(doc)
      const fragment = href.split('#')[1]
      if (fragment) setTimeout(() => document.getElementById(decodeURIComponent(fragment))?.scrollIntoView(), 80)
    } catch (error) { report(error) }
  }
  useEffect(() => {
    if (!referenceLocation || active?.id !== referenceLocation.sourceId) return
    const frame = requestAnimationFrame(() => {
      const elements = [...(articleRef.current?.querySelectorAll<HTMLElement>('[data-source-start]') ?? [])]
      const element = elements.find(node => Number(node.dataset.sourceStart) <= referenceLocation.line && Number(node.dataset.sourceEnd) >= referenceLocation.line)
      element?.scrollIntoView({ block: 'center' })
    })
    const timer = setTimeout(() => setReferenceLocation(null), 5000)
    return () => { cancelAnimationFrame(frame); clearTimeout(timer) }
  }, [referenceLocation, active?.id])
  const openReference = (reference: NoteReference) => {
    const source = docs.find(doc => doc.id === reference.sourceId)
    if (source) { openDoc(source); setReferenceLocation(reference) }
  }
  const stats = active ? documentStats(active.content) : null

  const settings = <Dialog><DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Preferências"><Settings2 size={17} /></Button></DialogTrigger>
    <DialogContent className="settings-dialog"><DialogHeader><DialogTitle>Do seu jeito.</DialogTitle><DialogDescription>Ajuste seu espaço de leitura.</DialogDescription></DialogHeader>
      <div className="setting-themes"><strong>Aparência</strong><small>Escolha uma atmosfera para a interface e as artes.</small><ThemeOptions value={theme.id} onChange={theme => setPrefs(old => ({ ...old, theme }))} /></div>
      <div className="setting-row"><div><strong>Arte ASCII</strong><small>Escolha a arte que acompanha sua biblioteca.</small></div><AsciiGallery value={prefs.asciiArt} theme={prefs.theme} onChange={asciiArt => setPrefs(old => ({ ...old, asciiArt }))} /></div>
      <div className="setting-row"><div><strong>Fundo em movimento</strong><small>{ASCII_RENDERING_ENABLED ? 'A preferência do sistema também é respeitada.' : 'Temporariamente pausado para revisão de estabilidade.'}</small></div><button role="switch" aria-checked={prefs.motion && ASCII_RENDERING_ENABLED} aria-label="Fundo em movimento" disabled={!ASCII_RENDERING_ENABLED} className={`toggle ${prefs.motion && ASCII_RENDERING_ENABLED ? 'on' : ''}`} onClick={() => setPrefs(old => ({ ...old, motion: !old.motion }))}><span /></button></div>
      <div className="setting-row"><div><strong>Leitura ampla</strong><small>Mais espaço para tabelas e código.</small></div><button role="switch" aria-checked={prefs.readingWidth === 'wide'} aria-label="Leitura ampla" className={`toggle ${prefs.readingWidth === 'wide' ? 'on' : ''}`} onClick={() => setPrefs(old => ({ ...old, readingWidth: old.readingWidth === 'wide' ? 'comfortable' : 'wide' }))}><span /></button></div>
      <div className="settings-note"><Sparkles size={17} /><p>Leia, escreva e registre suas ideias.<br /><span>A barra da nota reúne edição, prévia e comentários no texto.</span></p></div>
    </DialogContent></Dialog>

  return <div className={`app ${native ? 'native-app' : ''} ${active ? 'is-reading' : 'is-home'}`} onDragOver={event => { event.preventDefault(); if (!native) setDragging(true) }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false) }} onDrop={async event => {
    event.preventDefault(); setDragging(false)
    if (!native) try { const incoming = await importDropped([...event.dataTransfer.files]); mergeDocs(incoming); if (incoming[0]) openDoc(incoming[0]); else setToast('Arraste um arquivo .md ou .markdown.') } catch (error) { report(error) }
  }}>
    <header className="app-header" data-tauri-drag-region={native || undefined}>{native && <div className="window-drag-strip" data-tauri-drag-region aria-hidden="true" />}<button className="brand" onClick={() => { setHomeView('library'); setSession(old => ({ ...old, active: null })) }} aria-label="Noetia — início" title="Voltar à biblioteca inicial"><img src="/witch-icon.png" alt="" /><span>noetia<span className="brand-dot">.</span></span></button>
      {active ? <div className="header-tabs" data-tauri-drag-region={native || undefined}><div ref={tabsRef} className="tabs" data-tauri-drag-region={native || undefined} role="tablist" aria-label="Documentos abertos">{session.tabs.map(id => {
        const doc = docs.find(item => item.id === id); if (!doc) return null
        return <div key={id} className={`tab ${id === active.id ? 'active' : ''}`}><button role="tab" aria-selected={id === active.id} onClick={() => openDoc(doc)} title={doc.path}><span>{doc.name}</span></button><button className="close-tab" aria-label={`Fechar ${doc.name}`} onClick={() => closeTab(id)}><X size={13} /></button></div>
      })}</div></div> : <div className="header-center" data-tauri-drag-region={native || undefined}><span className="status-dot" data-tauri-drag-region={native || undefined} /><span data-tauri-drag-region={native || undefined}>{native ? 'Seu espaço de leitura' : 'Prévia web · arquivos locais'}</span></div>}
      <div className="header-actions"><button className={`header-universes ${homeView==='universes'&&!active?'selected':''}`} aria-label="Explorar universos" onClick={() => { setHomeView('universes'); setSession(old=>({...old,active:null})) }}><Orbit size={17}/><span>Universos</span></button><ThemePicker value={theme.id} onChange={theme => setPrefs(old => ({ ...old, theme }))} />{settings}</div>
      {native && <WindowControls onError={report} />}
    </header>

    {!active ? homeView === 'universes' ? <UniverseWorkspace docs={userDocs} roots={roots} ready={ready} busy={busy} theme={prefs.theme} onOpen={openDoc} onReference={openReference} onLibrary={()=>setHomeView('library')} onPick={folder=>void pick(folder)} onError={report}/> : <main className="home-workspace">
      <aside className="home-navigation"><span className="nav-caption">SEU ESPAÇO</span><nav aria-label="Navegação da biblioteca">
        <button className={homeFilter === 'all' && !selectedFolder ? 'selected' : ''} onClick={() => { setHomeFilter('all'); setHomeFolder(null); setQuery('') }}><Library size={17} /><span>Biblioteca</span><small>{userDocs.length}</small></button>
        <button className={homeFilter === 'favorites' ? 'selected' : ''} onClick={() => { setHomeFilter('favorites'); setHomeFolder(null); setQuery('') }}><Star size={17} /><span>Favoritos</span></button>
        <button className={homeFilter === 'recent' ? 'selected' : ''} onClick={() => { setHomeFilter('recent'); setHomeFolder(null); setHomeOrder('opened'); setQuery('') }}><Clock3 size={17} /><span>Recentes</span></button>
      </nav><div className="nav-sources"><span className="nav-caption">PASTAS NA BIBLIOTECA</span>{folders.length ? <LibraryFolders tree={folders} selectedId={selectedFolder?.id ?? null} onSelect={id => { setHomeFolder(id); setHomeFilter('all'); setQuery('') }} /> : <p>As pastas que você adicionar<br />aparecem aqui.</p>}<button className="add-source" onClick={() => void pick(true)} disabled={busy || !ready}><Plus size={14} />Adicionar pasta</button></div>
        <SidebarArtwork theme={prefs.theme} /><div className="nav-bottom"><img className="nav-avatar" src="/witch-icon.png" alt="" /><div><strong>Seu acervo, local.</strong><small>Uma nota de cada vez.</small></div></div>
      </aside>
      <div className="home-content"><div className="home-atmosphere" aria-hidden="true"><AnimatedAsciiBackdrop motion={prefs.motion} theme={prefs.theme} src={artwork.src} /><div className="home-atmosphere-shade" /></div><header className="collection-header"><div><span className="eyebrow">LEIA, ANOTE, DESCUBRA</span><h1>{homeFilter === 'favorites' ? 'Favoritos' : homeFilter === 'recent' ? 'Recentes' : 'Biblioteca'}<span className="title-dot">.</span></h1><p>Documentos de diferentes pastas. Um lugar para explorar.</p></div><div className="collection-actions"><Button variant="outline" onClick={() => void pick(true)} disabled={busy || !ready}><FolderOpen size={15} />Adicionar pasta</Button><Button onClick={() => void pick(false)} disabled={busy || !ready}><Plus size={15} />Abrir arquivo</Button></div></header>
        <div className="collection-grid"><section className="collection-documents"><div className="collection-section-heading"><h2>Seus documentos</h2><span aria-live="polite">{homeDocs.length.toLocaleString('pt-BR')} {homeDocs.length === 1 ? 'arquivo' : 'arquivos'}</span></div>
          {selectedFolder && <nav className="collection-scope" aria-label="Pasta selecionada"><button onClick={() => setHomeFolder(null)}>Todas as pastas</button>{selectedTrail.map(folder => <span key={folder.id}><ChevronRight size={12} /><button aria-current={folder.id === selectedFolder.id ? 'page' : undefined} title={folder.path} onClick={() => setHomeFolder(folder.id)}>{folder.name}</button></span>)}</nav>}
          <div className="collection-tools"><div className="collection-search"><Search size={16} /><input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nome ou conteúdo…" aria-label="Buscar em seus documentos" /><kbd>Ctrl K</kbd>{query && <button aria-label="Limpar busca" onClick={() => setQuery('')}><X size={15} /></button>}</div>
            <div className="collection-selects"><label><span>Mostrar</span><select aria-label="Filtrar documentos" value={homeFilter} onChange={event => { const filter = event.target.value as CollectionFilter; setHomeFilter(filter); if (filter === 'recent') setHomeOrder('opened') }}><option value="all">Todos</option><option value="favorites">Favoritos</option><option value="recent">Recentes</option></select></label><label><span>Ordenar</span><select aria-label="Ordenar documentos" value={homeOrder} onChange={event => setHomeOrder(event.target.value as CollectionOrder)}>{collectionOrders.map(order => <option key={order.value} value={order.value}>{order.label}</option>)}</select></label></div>
          </div>
          {homeDocs.length ? <div className="collection-table-scroll" role="region" aria-label="Lista de documentos" tabIndex={0}><table className="collection-table"><thead><tr><th>DOCUMENTO</th><th>LEITURA</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{homeDocs.map(doc => <tr key={doc.id}><td><button className="collection-file" onClick={() => openDoc(doc)}><span className="file-tile"><FileText size={19} /></span><span className="collection-file-copy"><strong>{doc.name.replace(/\.(md|markdown)$/i, '')}</strong><DocumentLocation doc={doc} roots={roots} /></span></button></td><td><span className="reading-time">{documentStats(doc.content).minutes} min</span></td><td><button className={`row-star ${session.favorites.includes(doc.id) ? 'is-favorite' : ''}`} aria-label={`${session.favorites.includes(doc.id) ? 'Remover favorito' : 'Favoritar'} ${doc.name}`} onClick={() => toggleFavorite(doc.id)}><Star size={15} /></button><button className="row-open" aria-label={`Ler ${doc.name}`} onClick={() => openDoc(doc)}><ArrowUpRight size={16} /></button></td></tr>)}</tbody></table></div>
          : <div className="collection-empty"><span className="empty-book"><BookOpen size={32} /></span><h3>{query ? 'Não encontramos esse trecho.' : homeFilter === 'favorites' ? 'Guarde o que vale reler.' : homeFilter === 'recent' ? 'Sua próxima leitura começa aqui.' : 'Uma biblioteca começa com uma nota.'}</h3><p>{query ? 'Tente outra palavra ou adicione mais documentos.' : homeFilter === 'favorites' ? 'Marque documentos com a estrela para encontrá-los aqui.' : 'Abra um Markdown ou adicione uma pasta com seus documentos.'}</p>{!query && homeFilter === 'all' && <Button variant="outline" onClick={() => void pick(false)} disabled={busy || !ready}><Plus size={15} />Escolher meu primeiro arquivo</Button>}</div>}
          <button className="example-strip" onClick={() => openDoc(sample)}><span><BookOpen size={20} /></span><div><strong>Explore o Noetia</strong><small>Um documento de exemplo para conhecer o leitor.</small></div><ArrowRight size={18} /></button>
          <p className="collection-storage"><span className="status-dot" />{native ? 'Os documentos permanecem nas pastas originais.' : 'Arquivos importados ficam guardados neste navegador.'}</p>
        </section></div><section className="home-art-controls" aria-label={`Arte ASCII: ${artwork.name}`}><div className="home-art-label"><span>ESTUDO {artwork.study} / {artwork.name}</span><AsciiGallery value={prefs.asciiArt} theme={prefs.theme} compact onChange={asciiArt => setPrefs(old => ({ ...old, asciiArt }))} /></div><span className="eyebrow">{artwork.eyebrow}</span><p>{artwork.caption}</p><small><span className="status-dot" />{prefs.motion ? 'ASCII em movimento' : 'Movimento desativado'}</small></section>
      </div>
    </main> : <div className="reader-layout">
      {sidebar && <aside className="library-sidebar" aria-label="Biblioteca de documentos"><div className="sidebar-heading"><div><span className="eyebrow">SEU ACERVO</span><h2>Biblioteca</h2></div><Button variant="ghost" size="icon" aria-label="Ocultar biblioteca" title="Ocultar biblioteca" onClick={() => setSidebar(false)}><PanelLeftClose size={16} /></Button></div>
        <div className="sidebar-search"><Search size={15} /><input ref={searchRef} aria-label="Buscar na biblioteca" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar notas…" /></div>
        <div className="library-filters"><button aria-pressed={!favoriteOnly} className={!favoriteOnly ? 'selected' : ''} onClick={() => setFavoriteOnly(false)}>Todas <span>{docs.length}</span></button><button aria-pressed={favoriteOnly} className={favoriteOnly ? 'selected' : ''} onClick={() => setFavoriteOnly(true)}>Favoritas</button></div>
        <div className="file-list-label"><span>{query ? 'RESULTADOS' : favoriteOnly ? 'FAVORITAS' : 'DOCUMENTOS'}</span><span>{visible.length}</span></div>
        <DocumentTree documents={visible} roots={roots} activeId={active.id} favorites={session.favorites} query={query} onOpen={openDoc} />
        <SidebarArtwork theme={prefs.theme} compact /><div className="sidebar-footer"><Button variant="outline" onClick={() => void pick(false)} disabled={busy}><FolderOpen size={14} />Abrir arquivo</Button><button className="sidebar-add-folder" onClick={() => void pick(true)} disabled={busy}>Adicionar pasta</button><small><span className="status-dot" />{native ? 'Biblioteca local' : 'Cópias locais no navegador'}</small></div>
      </aside>}
      <div className="reader-main">
        <div className="reader-toolbar"><div className="reader-location">{!sidebar && <button className="show-library" onClick={() => setSidebar(true)} aria-label="Mostrar biblioteca"><PanelLeftOpen size={16} /><span>Biblioteca</span></button>}<DocumentBreadcrumbs doc={active} roots={roots} docs={docs} onOpen={openDoc} /></div><button className={`favorite-button ${session.favorites.includes(active.id) ? 'is-favorite' : ''}`} onClick={() => toggleFavorite(active.id)} aria-label={session.favorites.includes(active.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}><Star size={16} /></button></div>
        <ReaderWorkspace key={active.id} doc={active} theme={prefs.theme} minutes={stats?.minutes ?? 1} readingWidth={prefs.readingWidth} articleRef={articleRef} canEdit={active.id !== sample.id} referenceLine={referenceLocation?.sourceId === active.id ? referenceLocation.line : undefined} onLink={href => void handleLink(href)} onError={report} onSaved={doc => { mergeDocs([doc]); setToast(native ? 'Arquivo Markdown salvo.' : 'Cópia local salva no navegador.') }} onScroll={position => {
          sessionRef.current.positions[active.id] = position
          // Save the latest position without rerendering the reader on every scroll event.
          if (ready) localStorage.setItem('noetia-session', JSON.stringify(sessionRef.current))
        }} toc={<aside className="toc-sidebar"><span className="eyebrow">NESTE DOCUMENTO</span><nav aria-label="Índice do documento">{toc.map(item => <button key={item.id} className={`toc-level-${item.level}`} onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}>{item.text}</button>)}</nav><div className="toc-note"><BookOpen size={18} /><p>Um pouco de espaço.<br />Uma nova perspectiva.</p></div></aside>} />
        <footer className="reader-status"><span><span className="status-dot" />{native ? 'Arquivo local' : 'Cópia local'}<span className="separator-dot">·</span>{stats?.words.toLocaleString('pt-BR')} palavras<span className="separator-dot">·</span>{stats?.lines} linhas</span><span>Markdown <Check size={12} /></span></footer>
      </div>
    </div>}
    {toast && <div className="toast" role="status"><span>{toast}</span><button aria-label="Fechar aviso" onClick={() => setToast('')}><X size={16} /></button></div>}
    {dragging && <div className="drop-overlay"><div><FileText size={40} /><h2>Solte suas ideias aqui.</h2><p>Abra seus arquivos Markdown no Noetia.</p></div></div>}
  </div>
}
