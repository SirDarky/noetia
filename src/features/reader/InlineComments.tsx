import { useLayoutEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Check, MessageSquare, Send, X } from 'lucide-react'
import { commentDomRange } from './comment-dom'
import type { NoteComment } from './workspace-model'

export interface CommentPoint { left: number; top: number; bottom: number }
export function CommentLayer({ rootRef, source, comments, activeId, onOpen }: {
  rootRef: RefObject<HTMLDivElement | null>; source: string; comments: NoteComment[]; activeId: string | null
  onOpen: (comment: NoteComment, point: CommentPoint) => void
}) {
  const [positions, setPositions] = useState<{ comment: NoteComment; rects: { left: number; top: number; width: number; height: number }[]; x: number; y: number }[]>([])
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    let frame = 0
    const update = () => {
      const bounds = root.getBoundingClientRect(), scroll = root.closest('article')!, article = scroll.getBoundingClientRect()
      const next = comments.filter(comment => !comment.resolved).flatMap(comment => {
        const range = commentDomRange(root, source, comment)
        if (!range) return []
        const seen = new Set<string>()
        const rects = [...range.getClientRects()].filter(rect => {
          const key = [rect.x, rect.y, rect.width, rect.height].join(':')
          if (!rect.width || !rect.height || seen.has(key)) return false
          seen.add(key); return true
        }).map(rect => ({ left: rect.left - bounds.left, top: rect.top - bounds.top, width: rect.width, height: rect.height }))
        if (!rects.length) return []
        return [{ comment, rects, x: Math.max(0, Math.min(bounds.width + 8, article.left + scroll.clientWidth - bounds.left - 40)), y: rects[0].top - 3 }]
      }).sort((a, b) => a.y - b.y || a.comment.created - b.comment.created)
      let previous = -Infinity
      for (const item of next) { item.y = Math.max(item.y, previous + 32); previous = item.y }
      setPositions(next)
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update) }
    update()
    const resize = new ResizeObserver(schedule), mutation = new MutationObserver(schedule)
    resize.observe(root); mutation.observe(root, { childList: true, subtree: true, characterData: true })
    window.addEventListener('resize', schedule)
    return () => { cancelAnimationFrame(frame); resize.disconnect(); mutation.disconnect(); window.removeEventListener('resize', schedule) }
  }, [rootRef, source, comments])
  return <div className="inline-comment-layer" data-comment-ui>{positions.map(item => <div key={item.comment.id}>
    {item.rects.map((rect, index) => <span aria-hidden="true" key={index} className={`inline-comment-highlight ${activeId === item.comment.id ? 'active' : ''}`} style={rect} />)}
    <button className={`inline-comment-pin ${activeId === item.comment.id ? 'active' : ''}`} style={{ left: item.x, top: item.y }} aria-label={`Abrir comentário: ${item.comment.quote || 'sobre a nota'}`} title={item.comment.text} onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); onOpen(item.comment, { left: rect.left, top: rect.top, bottom: rect.bottom }) }}><MessageSquare size={13} /><span>{comments.findIndex(comment => comment.id === item.comment.id) + 1}</span></button>
  </div>)}</div>
}
export function SelectionCommentButton({ point, onClick }: { point: CommentPoint; onClick: () => void }) {
  return createPortal(<button className="selection-comment-button" style={{ left: Math.max(8, Math.min(point.left, innerWidth - 212)), top: Math.max(55, point.top - 43) }} onPointerDown={event => event.preventDefault()} onClick={onClick}><MessageSquare size={15} />Comentar <kbd>Ctrl Alt M</kbd></button>, document.body)
}
export function CommentPopover({ point, comment, quote, text, setText, onSubmit, onClose, onResolve, onVisit, orphaned }: {
  point: CommentPoint; comment?: NoteComment; quote: string; text: string; setText: (text: string) => void
  onSubmit: () => void; onClose: () => void; onResolve?: () => void; onVisit?: () => void; orphaned?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null), input = useRef<HTMLTextAreaElement>(null)
  const [position, setPosition] = useState({ left: 8, top: 55 })
  useLayoutEffect(() => {
    const root = ref.current!
    const update = () => {
      const margin = 12, width = root.offsetWidth, height = root.offsetHeight
      setPosition({ left: Math.max(margin, Math.min(point.left + 34, innerWidth - width - margin)), top: Math.max(55, Math.min(point.bottom + 8, innerHeight - height - margin)) })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(root)
    window.addEventListener('resize', update)
    return () => { observer.disconnect(); window.removeEventListener('resize', update) }
  }, [point])
  useLayoutEffect(() => { if (!comment) input.current?.focus() }, [comment?.id])
  useLayoutEffect(() => {
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }
    function outside(event: PointerEvent) { const target = event.target as Element; if (!ref.current?.contains(target) && !target.closest('.inline-comment-pin')) onClose() }
    document.addEventListener('keydown', escape)
    document.addEventListener('pointerdown', outside)
    return () => { document.removeEventListener('keydown', escape); document.removeEventListener('pointerdown', outside) }
  }, [onClose])
  const submit = (event: FormEvent) => { event.preventDefault(); if (text.trim()) onSubmit() }
  return createPortal(<section ref={ref} className="inline-comment-popover" style={position} role="dialog" aria-label={comment ? 'Conversa sobre o trecho' : 'Comentar trecho'}>
    <header><span><MessageSquare size={16} />{comment ? 'Comentário' : 'Comentar trecho'}</span><div>{comment && onResolve && <button aria-label={comment.resolved ? 'Reabrir comentário' : 'Resolver comentário'} title={comment.resolved ? 'Reabrir comentário' : 'Resolver comentário'} onClick={onResolve}><Check size={16} /></button>}<button aria-label="Fechar comentário" onClick={onClose}><X size={16} /></button></div></header>
    {quote && <button className="inline-comment-quote" onClick={onVisit} disabled={!onVisit} title={onVisit ? 'Ir ao trecho comentado' : undefined}>{quote}</button>}
    {orphaned && <p className="inline-comment-warning" role="status">O trecho mudou ou ficou ambíguo. Sua citação foi preservada.</p>}
    {comment && <div className="inline-comment-thread"><CommentMessage created={comment.created}>{comment.text}</CommentMessage>{comment.replies?.map(reply => <CommentMessage key={reply.id} created={reply.created}>{reply.text}</CommentMessage>)}</div>}
    {comment?.resolved ? <p className="inline-comment-resolved"><Check size={14} />Comentário resolvido. Você pode reabri-lo.</p> : <form onSubmit={submit}><label htmlFor="inline-comment-text" className="sr-only">{comment ? 'Responder ao comentário' : 'Escrever comentário'}</label><textarea ref={input} id="inline-comment-text" aria-label={comment ? 'Responder ao comentário' : 'Escrever comentário'} value={text} onChange={event => setText(event.target.value)} placeholder={comment ? 'Adicionar uma resposta…' : 'O que você quer registrar neste trecho?'} maxLength={10000} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && text.trim()) { event.preventDefault(); onSubmit() } }} /><footer><small>Somente neste dispositivo</small><button type="submit" disabled={!text.trim()}><Send size={14} />{comment ? 'Responder' : 'Comentar'}</button></footer></form>}
  </section>, document.body)
}
function CommentMessage({ created, children }: { created: number; children: ReactNode }) {
  return <div className="inline-comment-message"><div><strong>Você</strong><time dateTime={new Date(created).toISOString()}>{new Date(created).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</time></div><p>{children}</p></div>
}
