import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Bold, BookOpen, Clock3, Italic, List, MessageSquare, Pencil, Plus, Save, Sparkles, X, Check } from 'lucide-react'
import { MarkdownReader } from './MarkdownReader'
import { commentLine, formatSelection, parseComments, parseDraft, preserveLineEndings, type NoteComment, type NoteDraft } from './workspace-model'
import { saveDocument, native } from '../../services/files'
import type { MarkdownDocument } from '../../types'
import './workspace.css'
import { createAnchor, editorOffset, lineSelection, resolveAnchor, sourceOffset } from './comment-anchors'
import { anchorFromRange, commentDomRange, editorCommentPoint, type PendingComment } from './comment-dom'
import { CommentLayer, CommentPopover, SelectionCommentButton, type CommentPoint } from './InlineComments'

import { sessionDrafts, volatileDrafts } from './draft-session'
const draftKey = (id: string) => 'noetia-draft:' + id
const commentsKey = (id: string) => 'noetia-comments:' + id
function loadDraft(doc: MarkdownDocument): NoteDraft {
  let saved = sessionDrafts.get(doc.id)
  try { saved ??= parseDraft(localStorage.getItem(draftKey(doc.id))) ?? undefined } catch {}
  return saved && saved.text !== doc.content ? saved : { text: doc.content, baseContent: doc.content }
}
function loadComments(id: string) { try { return parseComments(localStorage.getItem(commentsKey(id))) } catch { return [] } }

export function ReaderWorkspace({ doc, theme, minutes, readingWidth, articleRef, toc, canEdit, referenceLine, onLink, onError, onSaved, onScroll }: {
  doc: MarkdownDocument; theme: string; minutes: number; readingWidth: string; articleRef: RefObject<HTMLElement | null>; toc: ReactNode; canEdit: boolean; referenceLine?: number
  onLink: (href: string) => void; onError: (error: unknown) => void; onSaved: (doc: MarkdownDocument) => void; onScroll: (position: number) => void
}) {
  const [draft, setDraft] = useState(() => loadDraft(doc))
  const [editing, setEditing] = useState(() => !!sessionDrafts.get(doc.id) || loadDraft(doc).text !== doc.content)
  const [preview, setPreview] = useState(false), [saving, setSaving] = useState(false), [draftStored, setDraftStored] = useState(true)
  const [comments, setComments] = useState(() => loadComments(doc.id)), [commentsOpen, setCommentsOpen] = useState(false)
  const [commentText, setCommentText] = useState(''), [selection, setSelection] = useState<PendingComment>({ quote: '', sourceExcerpt: '' })
  const [selectionPoint, setSelectionPoint] = useState<CommentPoint | null>(null), [popoverPoint, setPopoverPoint] = useState<CommentPoint | null>(null)
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null)
  const [showResolved, setShowResolved] = useState(false)
  const markdownRef = useRef<HTMLDivElement>(null)
  const [commentHighlight, setCommentHighlight] = useState<number | undefined>()
  const editorRef = useRef<HTMLTextAreaElement>(null), savingRef = useRef(false), dirty = draft.text !== draft.baseContent
  const latestDoc = useRef(doc); latestDoc.current = doc
  const pendingFocus = useRef<{ start: number; end: number } | null>(null)

  useEffect(() => {
    if (!dirty) { setDraft({ text: doc.content, baseContent: doc.content }) }
  }, [doc.content])
  useEffect(() => {
    if (!dirty) { volatileDrafts.delete(doc.id); sessionDrafts.delete(doc.id); try { localStorage.removeItem(draftKey(doc.id)) } catch {} return }
    sessionDrafts.set(doc.id, draft)
    try { localStorage.setItem(draftKey(doc.id), JSON.stringify(draft)); volatileDrafts.delete(doc.id); setDraftStored(true) }
    catch { volatileDrafts.add(doc.id); setDraftStored(false) }
  }, [draft, dirty, doc.id])
  useEffect(() => {
    if (editing && !preview && pendingFocus.current) { const focus = pendingFocus.current; editorRef.current?.focus(); editorRef.current?.setSelectionRange(focus.start, focus.end); pendingFocus.current = null }
  }, [editing, preview, draft.text])
  async function save() {
    if (!canEdit || !dirty || savingRef.current) return
    savingRef.current = true; setSaving(true)
    const submitted = draft
    try {
      const next = await saveDocument(latestDoc.current, preserveLineEndings(submitted.text, submitted.baseContent), submitted.baseContent)
      const cached = sessionDrafts.get(doc.id)
      if (cached && cached.text !== submitted.text) {
        const pending = { text: cached.text, baseContent: next.content }
        sessionDrafts.set(doc.id, pending)
        try { localStorage.setItem(draftKey(doc.id), JSON.stringify(pending)) } catch {}
      } else { volatileDrafts.delete(doc.id); sessionDrafts.delete(doc.id); try { localStorage.removeItem(draftKey(doc.id)) } catch {} }
      setDraft(current => ({ text: current.text === submitted.text ? next.content : current.text, baseContent: next.content }))
      onSaved(next)
    } catch (error) { onError(error) } finally { savingRef.current = false; setSaving(false) }
  }
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      if (event.key.toLowerCase() === 's') { event.preventDefault(); void save() }
    }
    document.addEventListener('keydown', shortcut)
    const protect = (event: BeforeUnloadEvent) => { if (dirty && !draftStored) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', protect)
    return () => { document.removeEventListener('keydown', shortcut); window.removeEventListener('beforeunload', protect) }
  }, [draft, dirty, draftStored, canEdit])
  const source = editing ? draft.text : doc.content
  const shownDoc = editing && preview ? { ...doc, content: draft.text } : doc
  const activeComment = comments.find(comment => comment.id === activeCommentId)
  const closeComment = () => { setPopoverPoint(null); setActiveCommentId(null); setCommentText('') }
  function beginComment(point = selectionPoint) {
    if (!selection.quote || !point) { commentEditorLine(); return }
    setActiveCommentId(null); setCommentText(''); setCommentsOpen(false); setSelectionPoint(null); setPopoverPoint(point)
  }
  function captureSelection() {
    if (popoverPoint || (editing && !preview)) return
    const selected = window.getSelection(), root = markdownRef.current
    if (!selected || selected.isCollapsed || !selected.rangeCount || !root) { setSelectionPoint(null); return }
    const range = selected.getRangeAt(0)
    const pending = anchorFromRange(root, range, source)
    if (!pending) { setSelectionPoint(null); return }
    const rect = range.getBoundingClientRect()
    setSelection(pending); setSelectionPoint({ left: rect.left, top: rect.top, bottom: rect.bottom })
  }
  function captureEditorSelection() {
    if (popoverPoint) return
    const element = editorRef.current
    if (!element || element.selectionStart === element.selectionEnd) { setSelectionPoint(null); return }
    const anchor = createAnchor(draft.text, sourceOffset(draft.text, element.selectionStart), sourceOffset(draft.text, element.selectionEnd))
    if (anchor) { setSelection({ quote: anchor.exact, sourceExcerpt: anchor.exact, anchor }); setSelectionPoint(editorCommentPoint(element)) }
  }
  function commentEditorLine() {
    const editor = editorRef.current
    if (!editing || preview || !editor) { setCommentsOpen(true); return }
    const start = sourceOffset(draft.text, editor.selectionStart), end = sourceOffset(draft.text, editor.selectionEnd)
    const range = start === end ? lineSelection(draft.text, start) : { start, end }
    const anchor = createAnchor(draft.text, range.start, range.end)
    if (!anchor) { onError('Selecione uma palavra ou uma linha com até 4.000 caracteres para comentar.'); return }
    const point = editorCommentPoint(editor)
    setSelection({ quote: anchor.exact, sourceExcerpt: anchor.exact, anchor }); setActiveCommentId(null); setCommentText(''); setSelectionPoint(null); setCommentsOpen(false)
    setPopoverPoint(point)
  }
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'm') { event.preventDefault(); if (!popoverPoint) beginComment() } }
    document.addEventListener('keydown', shortcut); return () => document.removeEventListener('keydown', shortcut)
  })
  function format(action: 'bold' | 'italic' | 'list' | 'append') {
    const element = editorRef.current
    const next = formatSelection(draft.text, element?.selectionStart ?? draft.text.length, element?.selectionEnd ?? draft.text.length, action)
    pendingFocus.current = next; setDraft(old => ({ ...old, text: next.text })); setEditing(true); setPreview(false)
  }
  function addComment() {
    if (!commentText.trim()) return
    if (activeComment) {
      const reply = { id: crypto.randomUUID(), text: commentText.trim(), created: Date.now() }
      if (persistComments(comments.map(comment => comment.id === activeComment.id ? { ...comment, replies: [...(comment.replies ?? []), reply] } : comment))) setCommentText('')
      return
    }
    const comment: NoteComment = { id: crypto.randomUUID(), ...selection, text: commentText.trim(), created: Date.now() }
    if (persistComments([...comments, comment])) { setCommentText(''); setSelection({ quote: '', sourceExcerpt: '' }); setActiveCommentId(comment.id) }
  }
  function persistComments(next: NoteComment[]) {
    try { localStorage.setItem(commentsKey(doc.id), JSON.stringify(next)); setComments(next); return true }
    catch { onError('Não foi possível guardar o comentário. Copie o texto e tente novamente.'); return false }
  }
  function openComment(comment: NoteComment, point?: CommentPoint) {
    const range = markdownRef.current && commentDomRange(markdownRef.current, source, comment), rect = range?.getBoundingClientRect()
    setActiveCommentId(comment.id); setCommentText(''); setCommentsOpen(false); setSelectionPoint(null)
    setPopoverPoint(point ?? { left: rect?.left ?? innerWidth - 380, top: rect?.top ?? 100, bottom: rect?.bottom ?? 120 })
  }
  function visitComment(comment: NoteComment) {
    if (comment.anchor?.kind === 'source' && editing && !preview) {
      const range = resolveAnchor(source, comment.anchor)
      if (range) { editorRef.current?.focus(); editorRef.current?.setSelectionRange(editorOffset(source, range.start), editorOffset(source, range.end)); return }
    }
    const range = markdownRef.current && commentDomRange(markdownRef.current, source, comment)
    if (range) { const selected = window.getSelection(); selected?.removeAllRanges(); selected?.addRange(range); const node = range.startContainer.parentElement; node?.scrollIntoView({ block: 'center', behavior: 'instant' }); return }
    const line = commentLine(source, comment)
    if (!line) { onError('O trecho mudou ou não tem um destino único. A citação continua guardada no comentário.'); return }
    setCommentHighlight(line)
    if (editing && !preview) {
      const start = source.split('\n').slice(0, line - 1).join('\n').length + (line > 1 ? 1 : 0)
      editorRef.current?.focus(); editorRef.current?.setSelectionRange(start, start + comment.sourceExcerpt.length)
    } else {
      const target = [...(articleRef.current?.querySelectorAll<HTMLElement>('[data-source-start]') ?? [])].find(node => Number(node.dataset.sourceStart) <= line && Number(node.dataset.sourceEnd) >= line)
      target?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    }
  }
  return <div className={`reading-area note-workspace ${editing ? 'is-editing' : ''}`}>
    <article ref={articleRef} className={`markdown-scroll ${readingWidth}`} onPointerUp={captureSelection} onKeyUp={captureSelection} onScroll={event => {
      onScroll(event.currentTarget.scrollTop); setSelectionPoint(null)
      if (activeComment && markdownRef.current) { const rect = commentDomRange(markdownRef.current, source, activeComment)?.getBoundingClientRect(); if (rect) setPopoverPoint({ left: rect.left, top: rect.top, bottom: rect.bottom }) }
    }}>
      <div className="document-heading"><span className="eyebrow">{editing ? preview ? 'PRÉVIA DO RASCUNHO' : 'ESCREVA SUAS IDEIAS' : 'SEU ESPAÇO DE LEITURA'}</span><span>{dirty ? <><span className="draft-dot" />{draftStored ? 'Rascunho guardado' : 'Rascunho só nesta sessão'}</> : <><Clock3 size={12} />{minutes} min</>}</span></div>
      {dirty && draft.baseContent !== doc.content && <div className="editor-conflict" role="status"><p>O arquivo mudou fora do Noetia. Compare o arquivo atual com seu rascunho antes de salvar.</p><details><summary>Ver versão atual do arquivo</summary><textarea aria-label="Versão atual no arquivo" readOnly value={doc.content} /></details><button onClick={() => setDraft(old => ({ ...old, baseContent: doc.content }))}>Confirmar rascunho como versão reconciliada</button><small>Depois da comparação, este botão libera o salvamento sobre a versão exibida. Seu texto continua no editor.</small></div>}
      {editing && !preview ? <><div className="editor-comment-action"><span>Selecione uma palavra ou comente a linha do cursor.</span><button onClick={commentEditorLine}><MessageSquare size={14} />Comentar linha</button></div><label className="sr-only" htmlFor="markdown-editor">Editar Markdown</label><textarea id="markdown-editor" ref={editorRef} className="markdown-editor" value={draft.text} onChange={event => { setDraft(old => ({ ...old, text: event.target.value })); setSelectionPoint(null) }} onSelect={captureEditorSelection} spellCheck={false} disabled={saving} /><p className="editor-hint">Markdown · Ctrl + S para salvar {native ? 'no arquivo original' : 'na cópia local do navegador'} · Ctrl + Alt + M para comentar.</p></> : <><div className="annotated-markdown"><div ref={markdownRef} className="markdown-body"><MarkdownReader doc={shownDoc} theme={theme} onLink={onLink} onError={onError} highlightLine={commentHighlight ?? referenceLine} /></div><CommentLayer rootRef={markdownRef} source={source} comments={comments} activeId={activeCommentId} onOpen={openComment} /></div><div className="document-end"><Sparkles size={16} />Uma ideia leva à próxima.</div></>}
    </article>
    {!editing && toc}
    {commentsOpen && <aside className="note-comments" aria-label="Comentários da nota"><header><div><MessageSquare size={17} /><strong>Comentários</strong><span>{comments.length}</span></div><button aria-label="Fechar comentários" onClick={() => setCommentsOpen(false)}><X size={16} /></button></header><div className="comment-list"><label className="comment-resolved-filter"><input type="checkbox" checked={showResolved} onChange={event => setShowResolved(event.target.checked)} />Mostrar resolvidos</label>{!comments.some(comment => showResolved || !comment.resolved) && <p className="comment-empty">Selecione uma palavra ou uma linha e clique em Comentar. As conversas ficam marcadas no próprio texto.</p>}{comments.filter(comment => showResolved || !comment.resolved).map(comment => <button className="note-comment comment-summary" key={comment.id} onClick={() => openComment(comment)}><time dateTime={new Date(comment.created).toISOString()}>{new Date(comment.created).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}{comment.resolved && ' · Resolvido'}</time>{comment.quote && <blockquote>{comment.quote}</blockquote>}<p>{comment.text}</p><small>{comment.replies?.length ? `${comment.replies.length} ${comment.replies.length === 1 ? 'resposta' : 'respostas'} · ` : ''}Abrir conversa</small></button>)}</div><div className="comment-compose"><p>Comentários ficam no Noetia, separados do Markdown.</p></div></aside>}
    {selectionPoint && !popoverPoint && <SelectionCommentButton point={selectionPoint} onClick={() => beginComment()} />}
    {popoverPoint && <CommentPopover point={popoverPoint} comment={activeComment} quote={activeComment?.quote ?? selection.quote} text={commentText} setText={setCommentText} onSubmit={addComment} onClose={closeComment} onVisit={activeComment ? () => visitComment(activeComment) : undefined} onResolve={activeComment ? () => { if (persistComments(comments.map(comment => comment.id === activeComment.id ? { ...comment, resolved: !comment.resolved } : comment))) setCommentText('') } : undefined} orphaned={activeComment?.anchor ? activeComment.anchor.kind === 'source' ? !resolveAnchor(source, activeComment.anchor) : !!markdownRef.current && !commentDomRange(markdownRef.current, source, activeComment) : !!activeComment?.sourceExcerpt && !commentLine(source, activeComment)} />}
    <div className="note-floating-toolbar" role="toolbar" aria-label="Ferramentas da nota">
      <button className={editing ? 'selected' : ''} disabled={!canEdit || saving} aria-label={editing ? 'Voltar à leitura' : 'Editar Markdown'} aria-pressed={editing} title={canEdit ? editing ? 'Voltar à leitura; o rascunho é preservado' : 'Editar Markdown' : 'Abra um arquivo seu para editar'} onClick={() => { setEditing(!editing); setPreview(false); if (!editing) pendingFocus.current = { start: 0, end: 0 } }}><Pencil size={18} /></button>
      {editing && <><button aria-label="Prévia do Markdown" aria-pressed={preview} title="Prévia do rascunho" className={preview ? 'selected' : ''} onClick={() => setPreview(!preview)}><BookOpen size={18} /></button><span className="tool-divider" /><button disabled={saving} aria-label="Negrito" title="Negrito" onClick={() => format('bold')}><Bold size={18} /></button><button disabled={saving} aria-label="Itálico" title="Itálico" onClick={() => format('italic')}><Italic size={18} /></button><button disabled={saving} aria-label="Lista" title="Lista" onClick={() => format('list')}><List size={18} /></button></>}
      <button disabled={!canEdit || saving} aria-label="Adicionar texto" title="Adicionar texto no final da nota" onClick={() => format('append')}><Plus size={18} /></button><span className="tool-divider" />
      <button className={commentsOpen ? 'selected' : ''} aria-label={`Comentários${comments.length ? ` (${comments.length})` : ''}`} aria-pressed={commentsOpen} title={selectionPoint ? 'Comentar trecho selecionado' : 'Todos os comentários'} onClick={() => { if (selectionPoint) beginComment(); else { closeComment(); setCommentsOpen(!commentsOpen) } }}><MessageSquare size={18} />{comments.length > 0 && <small>{comments.length}</small>}</button>
      {editing && <><span className="tool-divider" /><button className="save-note" disabled={!dirty || saving} aria-label="Salvar Markdown" title="Salvar Markdown · Ctrl + S" onClick={() => void save()}>{saving ? <span className="saving-dot" /> : dirty ? <Save size={16} /> : <Check size={16} />}<span>{saving ? 'Salvando' : dirty ? 'Salvar' : 'Salvo'}</span></button></>}
    </div>
  </div>
}
