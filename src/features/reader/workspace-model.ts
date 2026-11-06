import { displayPath } from '../../lib/document-tree'
import type { MarkdownDocument } from '../../types'
import { parseAnchor, resolveAnchor, type CommentAnchor } from './comment-anchors'

export function folderContains(folder: string, path: string) {
  const base = displayPath(folder), target = displayPath(path)
  const windows = /^(?:[a-z]:|\/\/)/i.test(base)
  return windows ? target.toLowerCase().startsWith(base.toLowerCase() + '/') : target.startsWith(base + '/')
}
export function documentBreadcrumbs(doc: MarkdownDocument, roots: string[]) {
  const path = displayPath(doc.path), parent = path.slice(0, Math.max(0, path.lastIndexOf('/')))
  const root = roots.map(displayPath).filter(folder => folderContains(folder, path)).sort((a, b) => a.length - b.length)[0]
    ?? (/^(?:[a-z]:|\/)/i.test(path) ? parent : parent ? path.split('/')[0] : '')
  if (!root) return []
  const parts = parent.slice(root.length).replace(/^\//, '').split('/').filter(Boolean)
  const result = [{ name: root.split('/').pop() || root, path: root }]
  let current = root
  for (const name of parts) { current += '/' + name; result.push({ name, path: current }) }
  return result
}
export function preserveLineEndings(text: string, original: string) {
  return original.includes('\r\n') && !original.replace(/\r\n/g, '').includes('\n') ? text.replace(/\r?\n/g, '\r\n') : text
}
export interface NoteComment { id: string; quote: string; text: string; created: number; sourceExcerpt: string; anchor?: CommentAnchor; resolved?: boolean; replies?: { id: string; text: string; created: number }[] }
export interface NoteDraft { text: string; baseContent: string }
export function parseDraft(value: string | null): NoteDraft | null {
  try { const draft = JSON.parse(value || 'null'); return draft && typeof draft.text === 'string' && typeof draft.baseContent === 'string' ? draft : null } catch { return null }
}
export function parseComments(value: string | null): NoteComment[] {
  try {
    const items: unknown = JSON.parse(value || '[]')
    if (!Array.isArray(items)) return []
    return items.filter((item): item is NoteComment => !!item && typeof item === 'object' && typeof item.id === 'string' && typeof item.quote === 'string' && typeof item.text === 'string' && typeof item.created === 'number' && Number.isFinite(item.created) && Math.abs(item.created) <= 8.64e15 && typeof item.sourceExcerpt === 'string')
      .map(item => ({ ...item, anchor: parseAnchor(item.anchor), resolved: item.resolved === true, replies: Array.isArray(item.replies) ? item.replies.filter(reply => reply && typeof reply.id === 'string' && typeof reply.text === 'string' && Number.isFinite(reply.created) && Math.abs(reply.created) <= 8.64e15) : [] }))
  } catch { return [] }
}
// Only relocate an unchanged, unique source block; never silently attach to another occurrence.
export function commentLine(content: string, comment: NoteComment): number | undefined {
  if (comment.anchor) {
    if (comment.anchor.kind !== 'source') return
    const range = resolveAnchor(content, comment.anchor)
    return range ? content.slice(0, range.start).split('\n').length : undefined
  }
  if (!comment.sourceExcerpt) return undefined
  const index = content.indexOf(comment.sourceExcerpt)
  if (index < 0 || content.indexOf(comment.sourceExcerpt, index + 1) >= 0) return undefined
  return content.slice(0, index).split('\n').length
}
export function formatSelection(text: string, start: number, end: number, action: 'bold' | 'italic' | 'list' | 'append') {
  const selected = text.slice(start, end)
  let inserted = '', selectionStart = start, selectionEnd = end
  if (action === 'append') { start = end = text.length; inserted = '\n\n'; selectionStart = selectionEnd = start + inserted.length }
  else if (action === 'list') { inserted = (selected || 'Item').split('\n').map(line => '- ' + line).join('\n'); selectionStart = start; selectionEnd = start + inserted.length }
  else { const delimiter = action === 'bold' ? '**' : '*'; const body = selected || 'texto'; inserted = delimiter + body + delimiter; selectionStart = start + delimiter.length; selectionEnd = selectionStart + body.length }
  return { text: text.slice(0, start) + inserted + text.slice(end), start: selectionStart, end: selectionEnd }
}
