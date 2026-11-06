import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowUpRight, Check, FileText, FolderOpen, Library, List, Network, Orbit, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip'
import { SidebarArtwork } from '../home/SidebarArtwork'
import { searchDocuments } from '../../lib/documents'
import type { MarkdownDocument } from '../../types'
import { connectedDocumentIds, documentExcerpt, folderOf, indexReferences, parseUniverses, portableFolderKey, resolveUniverseFolder, suggestedUniverses, universeDocuments, universeFolders, type NoteReference, type Universe } from './model'
import { UniverseMap, type MapGroup } from './UniverseMap'

const storageKey = 'noetia-universes-v1'
type UniverseSeed = Pick<Universe,'name'|'description'|'documentIds'>
function savedUniverses() { try { return parseUniverses(localStorage.getItem(storageKey)) } catch { return null } }
function UniverseEditor({ universe, seed, docs, roots, onSave, onClose }: { universe?: Universe; seed?: UniverseSeed; docs: MarkdownDocument[]; roots: string[]; onSave: (universe: Universe)=>void; onClose: ()=>void }) {
  const folders = universeFolders(docs, roots)
  const [name,setName] = useState(universe?.name??seed?.name??''), [description,setDescription] = useState(universe?.description??seed?.description??'')
  const [mode,setMode] = useState<'folder'|'selection'>(universe ? universe.folder===null?'selection':'folder' : seed?'selection':folders.length?'folder':'selection')
  const [folder,setFolder] = useState(universe?.folder??folders[0]??''), [ids,setIds] = useState<string[]>(universe?.documentIds??seed?.documentIds??[])
  const [query,setQuery] = useState('')
  const matches = searchDocuments(docs,query)
  const draft = { id:universe?.id??'',name,description,folder:mode==='folder'?folder:null,documentIds:ids,portableFolder:mode==='folder'?portableFolderKey(folder,docs):undefined }
  const count = universeDocuments(draft,docs).length
  return <Dialog open onOpenChange={open=>{if(!open)onClose()}}><DialogContent className="universe-editor"><DialogHeader><DialogTitle>{universe?'Editar universo':'Um novo universo.'}</DialogTitle><DialogDescription>Reúna suas notas sem mover os arquivos originais.</DialogDescription></DialogHeader>
    <form onSubmit={event=>{event.preventDefault();if(name.trim())onSave({...draft,id:universe?.id??crypto.randomUUID(),name:name.trim(),description:description.trim()})}}>
      <label>Nome<input value={name} onChange={event=>setName(event.target.value)} placeholder="Meu projeto, estudos, ideias…" maxLength={80} required autoFocus/></label>
      <label>Descrição<textarea value={description} onChange={event=>setDescription(event.target.value)} placeholder="O que vive neste universo?" maxLength={300} rows={2}/></label>
      <fieldset><legend>Como reunir os arquivos</legend><label className="universe-radio"><input type="radio" name="universe-mode" checked={mode==='folder'} onChange={()=>setMode('folder')} disabled={!folders.length}/>Por pasta</label><label className="universe-radio"><input type="radio" name="universe-mode" checked={mode==='selection'} onChange={()=>setMode('selection')}/>Escolher arquivos</label></fieldset>
      {mode==='folder'&&<label>Pasta da biblioteca<select value={folder} onChange={event=>setFolder(event.target.value)}>{[...new Set([folder,...folders])].map(path=><option key={path} value={path}>{path||'Arquivos avulsos'}</option>)}</select><small>Inclui os arquivos cadastrados desta pasta e de suas subpastas.</small></label>}
      <div className="universe-file-picker"><label>{mode==='folder'?'Arquivos adicionais (opcional)':'Arquivos deste universo'}<input aria-label="Filtrar arquivos para o universo" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Nome, caminho ou conteúdo…"/></label>
        <div className="universe-picker-list">{matches.map(doc=><label key={doc.id} className="universe-picker-file"><input type="checkbox" checked={ids.includes(doc.id)} onChange={event=>setIds(old=>event.target.checked?[...old,doc.id]:old.filter(id=>id!==doc.id))}/><span><strong>{doc.name}</strong><small>{doc.path}</small></span></label>)}{!matches.length&&<p>Nenhum arquivo encontrado. Você pode adicionar arquivos depois.</p>}</div>
      </div>
      <footer><span>{count} {count===1?'arquivo':'arquivos'}</span><Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={!name.trim()}><Check size={14}/>{universe?'Salvar alterações':'Criar universo'}</Button></footer>
    </form>
  </DialogContent></Dialog>
}

export function UniverseWorkspace({ docs, roots, ready, busy, theme, onOpen, onReference, onLibrary, onPick, onError }: {
  docs: MarkdownDocument[]; roots: string[]; ready: boolean; busy: boolean; theme: string
  onOpen: (doc: MarkdownDocument)=>void; onReference: (reference: NoteReference)=>void
  onLibrary: ()=>void; onPick: (folder: boolean)=>void; onError: (error: unknown)=>void
}) {
  const [stored,setStored] = useState<Universe[]|null>(savedUniverses)
  const universes = useMemo(() => (stored??(ready?suggestedUniverses(docs,roots):[])).map(universe => ({...universe,folder:resolveUniverseFolder(universe,docs)})),[stored,ready,docs,roots])
  const [activeId,setActiveId] = useState<string|null>(null), [selected,setSelected] = useState<string|null>(null)
  const [query,setQuery] = useState(''), [view,setView] = useState<'map'|'table'>('map')
  const [editor,setEditor] = useState<{universe?: Universe;seed?:UniverseSeed}|null>(null), [removed,setRemoved] = useState<{universe: Universe;index:number}|null>(null)
  useEffect(()=>{if(ready&&stored===null)setStored(suggestedUniverses(docs,roots))},[ready,docs,roots,stored])
  useEffect(()=>{if(stored!==null)try{localStorage.setItem(storageKey,JSON.stringify(stored))}catch(error){onError(error)}},[stored,onError])
  const active = universes.find(u=>u.id===activeId)
  const references = useMemo(()=>indexReferences(docs),[docs])
  const excerpts = useMemo(()=>new Map(docs.map(doc=>[doc.id,documentExcerpt(doc.content)])),[docs])
  const memberships = useMemo(()=>new Map(universes.map(universe=>[universe.id,universeDocuments(universe,docs)])),[universes,docs])
  const scope = active?memberships.get(active.id)??[]:docs
  const filtered = searchDocuments(scope,query)
  const current = docs.find(doc=>doc.id===selected)
  const relevantRefs = references.filter(ref=>scope.some(doc=>doc.id===ref.sourceId))
  const resolvedRefs = relevantRefs.filter(ref=>ref.status==='resolved')
  const pendingRefs = relevantRefs.filter(ref=>ref.status==='missing'||ref.status==='ambiguous')
  const outgoing = current?references.filter(ref=>ref.sourceId===current.id):[]
  const incoming = current?references.filter(ref=>ref.targetId===current.id&&ref.status==='resolved'):[]
  const groups = useMemo<MapGroup[]>(()=>{
    if(!active)return universes.map(universe=>({id:universe.id,name:universe.name,subtitle:universe.description||universe.folder||'Arquivos escolhidos',docs:searchDocuments(memberships.get(universe.id)??[],query),universeId:universe.id,enter:()=>navigate(universe.id)}))
    const all = memberships.get(active.id)??[], members = new Set(all.map(doc=>doc.id))
    const buckets = new Map<string,MarkdownDocument[]>()
    searchDocuments(all,query).forEach(doc=>{const folder=folderOf(doc);buckets.set(folder,[...(buckets.get(folder)??[]),doc])})
    const result:MapGroup[]=[...buckets].map(([folder,groupDocs])=>({id:folder,name:folder.split('/').pop()||'Arquivos avulsos',subtitle:folder||'Notas sem pasta na prévia',docs:groupDocs,universeId:active.id}))
    const neighbors=new Set(references.filter(ref=>ref.targetId&&((members.has(ref.sourceId)&&!members.has(ref.targetId))||(!members.has(ref.sourceId)&&members.has(ref.targetId)))).flatMap(ref=>[ref.sourceId,ref.targetId!]).filter(id=>!members.has(id)))
    const external=searchDocuments(docs.filter(doc=>neighbors.has(doc.id)),query)
    if(external.length)result.push({id:'outside:'+active.id,name:'Além deste universo',subtitle:'Notas da biblioteca conectadas a este conjunto.',docs:external})
    return result
  },[active,universes,memberships,query,references,docs])
  function navigate(id: string|null){setActiveId(id);setSelected(null);setQuery('')}
  function remove(universe: Universe){setRemoved({universe,index:universes.findIndex(u=>u.id===universe.id)});setStored(universes.filter(u=>u.id!==universe.id));navigate(null)}
  function save(universe: Universe){setStored(old=>{const all=old??universes;return all.some(u=>u.id===universe.id)?all.map(u=>u.id===universe.id?universe:u):[...all,universe]});setEditor(null);navigate(universe.id)}
  function memberNames(docId:string){return universes.filter(u=>memberships.get(u.id)?.some(doc=>doc.id===docId)).map(u=>u.name)}
  return <main className="universes-workspace"><TooltipProvider delayDuration={180}>
    <aside className="universes-navigation"><button className="universes-library-link" onClick={onLibrary}><Library size={16}/>Biblioteca</button><div className="universes-nav-heading"><span className="eyebrow">SEUS UNIVERSOS</span><button aria-label="Criar universo" onClick={()=>setEditor({})} disabled={!ready}><Plus size={16}/></button></div>
      <nav aria-label="Universos"><button className={!active?'selected':''} onClick={()=>navigate(null)}><Orbit size={16}/><span>Todos os universos</span></button>
        {universes.map(universe=>{
          const members=memberships.get(universe.id)??[], ids=new Set(members.map(doc=>doc.id)), links=references.filter(ref=>ids.has(ref.sourceId)&&ref.status==='resolved')
          return <Tooltip key={universe.id}><TooltipTrigger asChild><button className={active?.id===universe.id?'selected':''} onClick={()=>navigate(universe.id)}><span className="universe-nav-light"/><span>{universe.name}</span><small>{members.length}</small></button></TooltipTrigger><TooltipContent className="universe-tooltip" side="right"><strong>{universe.name}</strong><p>{universe.description||'Um conjunto de ideias conectadas.'}</p><small>{members.length} arquivos · {links.length} referências</small></TooltipContent></Tooltip>
        })}
      </nav><button className="universes-add-source" onClick={()=>onPick(true)} disabled={busy||!ready}><FolderOpen size={14}/>Adicionar pasta</button><SidebarArtwork theme={theme} compact/><div className="universes-nav-bottom"><img src="/witch-icon.png" alt=""/><p>Pequenas notas.<br/><span>Infinitas possibilidades.</span></p></div>
    </aside>
    <section className="universes-content"><header className="universes-heading"><div><span className="eyebrow">EXPLORE SUAS CONEXÕES</span><h1>{active?.name??'Universos'}<span>.</span></h1><p>{active?.description||'Cada nota, uma estrela. Cada conexão, uma descoberta.'}</p></div><div className="universes-heading-actions">{active&&<button className="universes-edit" aria-label={`Editar universo ${active.name}`} onClick={()=>setEditor({universe:active})}><Pencil size={15}/></button>}<Button onClick={()=>setEditor({})} disabled={!ready}><Plus size={15}/>Novo universo</Button></div></header>
      <div className="universes-toolbar"><div className="universes-search"><Search size={16}/><input aria-label="Buscar nos universos" value={query} onChange={event=>setQuery(event.target.value)} placeholder={active?'Encontre uma estrela neste universo…':'Encontre uma estrela na biblioteca…'}/>{query&&<button aria-label="Limpar busca dos universos" onClick={()=>setQuery('')}><X size={14}/></button>}</div><div className="universes-view-toggle" aria-label="Visualização dos universos"><button aria-pressed={view==='map'} onClick={()=>setView('map')}><Network size={15}/>Mapa</button><button aria-pressed={view==='table'} onClick={()=>setView('table')}><List size={15}/>Tabela</button></div></div>
      <div className="universes-context">{active?<button onClick={()=>navigate(null)}><ArrowLeft size={13}/>Todos os universos</button>:<span>{universes.length} {universes.length===1?'universo':'universos'}</span>}<span>{scope.length} arquivos · {resolvedRefs.length} referências{pendingRefs.length?` · ${pendingRefs.length} ${pendingRefs.length===1?'pendente':'pendentes'}`:''}</span></div>
      {removed&&<div className="universe-undo" role="status"><span>Universo removido. Seus arquivos continuam na biblioteca.</span><button onClick={()=>{const next=[...universes];next.splice(removed.index,0,removed.universe);setStored(next);setRemoved(null)}}>Desfazer</button><button aria-label="Fechar aviso de universo removido" onClick={()=>setRemoved(null)}><X size={14}/></button></div>}
      <div className={`universes-stage ${current?'has-detail':''}`}>
        <div className="universes-explorer">{view==='map'?<UniverseMap groups={groups} references={references} selected={selected} onSelect={doc=>setSelected(doc.id)} excerpts={excerpts}/>:<div className="universes-table-wrap"><table className="universes-table"><thead><tr><th>Documento</th><th>Universos</th><th>Referências</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{filtered.map(doc=><tr key={doc.id} className={doc.id===selected?'selected':''}><td><button onClick={()=>setSelected(doc.id)}><FileText size={16}/><span><strong>{doc.name}</strong><small>{doc.path}</small></span></button></td><td>{memberNames(doc.id).join(', ')||'Sem universo'}</td><td>{references.filter(ref=>ref.sourceId===doc.id&&ref.status==='resolved').length}</td><td><button aria-label={`Abrir ${doc.name} dos universos`} onClick={()=>onOpen(doc)}><ArrowUpRight size={16}/></button></td></tr>)}</tbody></table>{!filtered.length&&<p className="universes-no-results">Nenhum arquivo encontrado.</p>}</div>}</div>
        {current&&<aside className="universe-note-detail" aria-label="Detalhes da estrela"><div className="universe-detail-heading"><span className="eyebrow">ESTRELA SELECIONADA</span><button aria-label="Fechar detalhes da estrela" onClick={()=>setSelected(null)}><X size={15}/></button></div><h2>{current.name.replace(/\.(md|markdown)$/i,'')}</h2><p className="universe-note-path">{current.path}</p><p className="universe-note-excerpt">{excerpts.get(current.id)||'Esta nota ainda está vazia.'}</p><Button onClick={()=>onOpen(current)}><ArrowUpRight size={15}/>Abrir documento</Button>
          <Button variant="outline" className="universe-gather" onClick={()=>setEditor({seed:{name:current.name.replace(/\.(md|markdown)$/i,'')+' e conexões',description:'Um universo sugerido a partir das referências desta nota.',documentIds:connectedDocumentIds(current.id,docs,references)}})}><Network size={14}/>Reunir conexões</Button>
          <div className="universe-note-memberships">{universes.filter(u=>memberships.get(u.id)?.some(doc=>doc.id===current.id)).map(u=><button key={u.id} onClick={()=>navigate(u.id)}><Orbit size={12}/>{u.name}</button>)}</div>
          <section><h3>Referências enviadas <span>{outgoing.length}</span></h3>{outgoing.map((ref,i)=><div key={i} className="universe-reference"><button onClick={()=>{if(ref.targetId)setSelected(ref.targetId);else onReference(ref)}}><span>{ref.label}</span><small>{ref.status==='missing'?'Destino não cadastrado':ref.status==='ambiguous'?'Nome ambíguo':ref.status==='external'?'Referência externa':docs.find(d=>d.id===ref.targetId)?.path}</small></button><button className="universe-reference-origin" onClick={()=>onReference(ref)}>Ver trecho · linha {ref.line}</button>{ref.status==='ambiguous'&&<div className="universe-candidates">{ref.candidates.map(id=>{const candidate=docs.find(d=>d.id===id);return candidate&&<button key={id} onClick={()=>setSelected(id)}>{candidate.path}</button>})}</div>}</div>)}{!outgoing.length&&<p>Esta nota ainda não cita outros arquivos.</p>}</section>
          <section><h3>Referências recebidas <span>{incoming.length}</span></h3>{incoming.map((ref,i)=><div key={i} className="universe-reference"><button onClick={()=>setSelected(ref.sourceId)}><span>{docs.find(doc=>doc.id===ref.sourceId)?.name}</span><small>{ref.section||'Referência no documento'}</small></button><button className="universe-reference-origin" onClick={()=>onReference(ref)}>Ver trecho · linha {ref.line}</button></div>)}{!incoming.length&&<p>Nenhuma referência recebida por enquanto.</p>}</section>
        </aside>}
      </div>
      {active&&<footer className="universe-settings-footer"><span>{active.folder===null?'Arquivos escolhidos manualmente.':`Pasta: ${active.folder||'Arquivos avulsos'}`}{active.documentIds.filter(id=>!docs.some(doc=>doc.id===id)).length>0?' Há arquivos indisponíveis neste conjunto.':''}</span><button onClick={()=>remove(active)}><Trash2 size={13}/>Remover universo</button></footer>}
      {!universes.length&&<div className="universes-first-step"><h2>Seu primeiro universo começa com uma nota.</h2><p>Adicione uma pasta ou reúna arquivos que já estão na biblioteca.</p><Button variant="outline" onClick={()=>setEditor({})} disabled={!ready}><Plus size={15}/>Criar meu primeiro universo</Button></div>}
    </section>
    {editor&&<UniverseEditor roots={roots} universe={editor.universe} seed={editor.seed} docs={docs} onSave={save} onClose={()=>setEditor(null)}/>}
  </TooltipProvider></main>
}
