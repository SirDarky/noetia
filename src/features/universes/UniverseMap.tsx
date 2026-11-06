import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Minus, Plus, Scan } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip'
import type { MarkdownDocument } from '../../types'
import type { NoteReference } from './model'

export interface MapGroup { id: string; name: string; subtitle: string; docs: MarkdownDocument[]; universeId?: string; enter?: () => void }
const hash = (text: string) => [...text].reduce((value, char) => ((value * 31 + char.charCodeAt(0)) >>> 0), 7)

export function UniverseMap({ groups, references, selected, onSelect, excerpts }: {
  groups: MapGroup[]; references: NoteReference[]; selected: string | null
  onSelect: (doc: MarkdownDocument) => void; excerpts: Map<string, string>
}) {
  const field = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600), [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 }), [hovered, setHovered] = useState<string | null>(null)
  const dragging = useRef<{ x: number; y: number; origin: typeof pan } | null>(null)
  const uid = useId().replace(/:/g, '')
  useEffect(() => { const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width))); observer.observe(field.current!); return () => observer.disconnect() }, [])
  const layout = useMemo(() => {
    const visibleGroups = groups.slice(0, 6), cols = width >= 560 && visibleGroups.length > 1 ? 2 : 1
    const rows = Math.ceil(visibleGroups.length / cols), height = Math.max(530, rows * 410 + 60), cellWidth = width / cols
    const nodes: { key: string; doc: MarkdownDocument; group: string; x: number; y: number }[] = []
    const centers = visibleGroups.map((group, index) => {
      const x = cellWidth * (index % cols + .5), y = rows === 1 ? height * .5 : Math.floor(index / cols) * 410 + 225
      const sorted = [...group.docs].sort((a,b) => a.id.localeCompare(b.id)).slice(0, 12)
      sorted.forEach((doc, i) => {
        const angle = i * Math.PI * 2 / sorted.length + .6
        const radius = sorted.length === 1 ? 0 : Math.min(cellWidth * .32, 130)
        const nodeColumns = cellWidth > 340 ? 3 : 2, nodeRows = Math.ceil(sorted.length / nodeColumns)
        const dx = sorted.length <= 5 ? Math.cos(angle)*radius : (i%nodeColumns-(nodeColumns-1)/2)*Math.min(120,(cellWidth-60)/nodeColumns)+(hash(doc.id)%13-6)
        const dy = sorted.length <= 5 ? Math.sin(angle)*radius*.7 : (Math.floor(i/nodeColumns)-(nodeRows-1)/2)*66
        nodes.push({ key: `${group.id}:${doc.id}`, doc, group: group.id, x: x + dx, y: y + dy })
      })
      return { ...group, x, y, radius: Math.min(cellWidth * .47, 215) }
    })
    const pairs = new Map<string, { source: typeof nodes[number]; target: typeof nodes[number]; count: number; bridge: boolean }>()
    for (const ref of references) {
      if (!ref.targetId || ref.targetId === ref.sourceId) continue
      const sources = nodes.filter(n=>n.doc.id===ref.sourceId), targets = nodes.filter(n=>n.doc.id===ref.targetId)
      for (const source of sources) {
        const target = targets.find(n=>n.group===source.group) ?? targets[0]
        if (!target) continue
        const key = [source.key,target.key].sort().join('|')
        const previous = pairs.get(key)
        if (previous) previous.count++
        else pairs.set(key,{source,target,count:1,bridge:(centers.find(group=>group.id===source.group)?.universeId??source.group)!==(centers.find(group=>group.id===target.group)?.universeId??target.group)})
      }
    }
    return { centers, nodes, edges: [...pairs.values()], height }
  }, [groups,references,width])
  useEffect(() => { setPan({x:0,y:0}); setZoom(1) }, [groups.map(g=>g.id).join('|')])
  const focused = hovered ?? selected
  const related = new Set(references.filter(ref=>ref.sourceId===focused||ref.targetId===focused).flatMap(ref=>[ref.sourceId,ref.targetId]).filter(Boolean))
  const total = groups.reduce((count,group)=>count+group.docs.length,0)

  return <TooltipProvider delayDuration={180}><div className="universe-map-frame">
    <div className="universe-map-tools" aria-label="Zoom do mapa">
      <button aria-label="Afastar mapa" disabled={zoom<=.6} onClick={()=>setZoom(old=>Math.max(.6,old-.2))}><Minus size={15}/></button>
      <span>{Math.round(zoom*100)}%</span>
      <button aria-label="Aproximar mapa" disabled={zoom>=2} onClick={()=>setZoom(old=>Math.min(2,old+.2))}><Plus size={15}/></button>
      <button aria-label="Ajustar mapa" onClick={()=>{setZoom(1);setPan({x:0,y:0})}}><Scan size={15}/></button>
    </div>
    <div ref={field} className="universe-cosmos" style={{height:layout.height}} aria-label="Mapa de arquivos e referências" onPointerDown={event=>{
      if ((event.target as Element).closest('button')) return
      dragging.current={x:event.clientX,y:event.clientY,origin:pan};event.currentTarget.setPointerCapture(event.pointerId)
    }} onPointerMove={event=>{
      if(dragging.current)setPan({x:dragging.current.origin.x+event.clientX-dragging.current.x,y:dragging.current.origin.y+event.clientY-dragging.current.y})
    }} onPointerUp={()=>{dragging.current=null}} onPointerCancel={()=>{dragging.current=null}}>
      <div className="universe-map-plane" style={{transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,height:layout.height}}>
        <svg width={width} height={layout.height} aria-hidden="true" className="universe-map-svg">
          <defs>
            <radialGradient id={`${uid}-nebula`}><stop offset="0" stopColor="var(--primary)" stopOpacity=".2"/><stop offset=".5" stopColor="var(--primary)" stopOpacity=".07"/><stop offset="1" stopColor="var(--primary)" stopOpacity="0"/></radialGradient>
            <radialGradient id={`${uid}-heart`}><stop offset="0" stopColor="var(--foreground)" stopOpacity=".12"/><stop offset="1" stopColor="var(--foreground)" stopOpacity="0"/></radialGradient>
          </defs>
          {layout.centers.map(center=><g key={center.id}>
            <ellipse cx={center.x} cy={center.y} rx={center.radius} ry={center.radius*.72} fill={`url(#${uid}-nebula)`} transform={`rotate(-25 ${center.x} ${center.y})`}/>
            <ellipse cx={center.x} cy={center.y} rx={center.radius*.75} ry={center.radius*.2} fill={`url(#${uid}-heart)`} transform={`rotate(-25 ${center.x} ${center.y})`}/>
            {[1,2].map(ring=><ellipse key={ring} className="universe-orbit" cx={center.x} cy={center.y} rx={center.radius*(ring===1?.68:.96)} ry={center.radius*(ring===1?.24:.38)} transform={`rotate(-25 ${center.x} ${center.y})`}/>) }
            {Array.from({length:26},(_,i)=>{const angle=(hash(center.id+String(i))%360)*Math.PI/180, radius=(i%9+1)/10*center.radius;return <circle key={i} cx={center.x+Math.cos(angle)*radius} cy={center.y+Math.sin(angle)*radius*.6} r={i%5===0?1.2:.65} fill="var(--primary)" opacity={i%5===0?.55:.25}/>})}
          </g>)}
          {layout.edges.map((edge,i)=>{
            const {source:a,target:b}=edge, highlighted=!!focused&&(a.doc.id===focused||b.doc.id===focused)
            const mx=(a.x+b.x)/2, my=(a.y+b.y)/2-(edge.bridge?60:20)
            return <path key={i} className={`universe-link ${edge.bridge?'is-bridge':''} ${highlighted?'is-highlighted':''}`} d={`M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`}/>
          })}
        </svg>
        {layout.centers.map(center=><Tooltip key={center.id}><TooltipTrigger asChild><button className="universe-constellation-label" style={{left:center.x,top:center.y-150}} onClick={center.enter} disabled={!center.enter} aria-label={`Entrar no universo ${center.name}`}><span>{center.name}</span><small>{center.docs.length} {center.docs.length===1?'estrela':'estrelas'}</small></button></TooltipTrigger><TooltipContent className="universe-tooltip"><strong>{center.name}</strong><p>{center.subtitle}</p><small>{center.docs.length} arquivos neste conjunto.</small></TooltipContent></Tooltip>) }
        {layout.nodes.map(node=>{
          const incoming=references.filter(ref=>ref.targetId===node.doc.id&&ref.status==='resolved').length, outgoing=references.filter(ref=>ref.sourceId===node.doc.id&&ref.status==='resolved').length
          return <Tooltip key={node.key}><TooltipTrigger asChild><button className={`universe-star ${selected===node.doc.id?'is-selected':''} ${focused&&related.has(node.doc.id)?'is-connected':''} ${focused&&focused!==node.doc.id&&!related.has(node.doc.id)?'is-distant':''}`} style={{left:node.x,top:node.y}} aria-label={`Selecionar estrela ${node.doc.name} em ${node.doc.path}`} aria-pressed={selected===node.doc.id} onClick={()=>onSelect(node.doc)} onMouseEnter={()=>setHovered(node.doc.id)} onMouseLeave={()=>setHovered(null)} onFocus={()=>setHovered(node.doc.id)} onBlur={()=>setHovered(null)}><span className="universe-star-light"/><span className="universe-star-name">{node.doc.name.replace(/\.(md|markdown)$/i,'')}</span></button></TooltipTrigger><TooltipContent className="universe-tooltip" sideOffset={15}><strong>{node.doc.name}</strong><small>{node.doc.path}</small><p>{excerpts.get(node.doc.id)||'Esta nota ainda está vazia.'}</p><span>{incoming} recebidas · {outgoing} enviadas</span></TooltipContent></Tooltip>
        })}
        {!layout.nodes.length&&<div className="universe-map-empty"><span>✧</span><strong>Nenhuma estrela por aqui.</strong><p>{total?'Tente outra busca.':'Crie um universo ou adicione arquivos à biblioteca.'}</p></div>}
      </div>
      <span className="universe-map-caption">UM MAPA DAS SUAS IDEIAS</span>
    </div>
    <div className="universe-map-legend"><span><i/>Arquivo</span><span><b/>Referência</span><span><b className="bridge"/>Ponte entre grupos</span><small>Arraste o espaço para explorar.</small></div>
    {layout.nodes.length<total&&<p className="universe-map-limit">{layout.nodes.length} de {total} posições exibidas. Escolha um universo, use a busca ou consulte a tabela para ver todos os arquivos.</p>}
  </div></TooltipProvider>
}
