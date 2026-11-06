import { createAnchor, resolveAnchor, type CommentAnchor } from './comment-anchors'
import { commentLine, type NoteComment } from './workspace-model'

interface TextPart { node: Text; start: number; end: number }
export function textIndex(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), parts: TextPart[] = []
  let text = '', node: Node | null
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest('button, svg, .diagram, .image-placeholder, [data-comment-ui]')) continue
    parts.push({ node: node as Text, start: text.length, end: text.length + (node.textContent?.length ?? 0) }); text += node.textContent ?? ''
  }
  return { text, parts }
}
function pointOffset(root: HTMLElement, node: Node, offset: number, parts: TextPart[]) {
  if (!root.contains(node)) return
  const direct = parts.find(part => part.node === node)
  if (direct) return direct.start + offset
  // Element boundaries occur with keyboard selections and select-all.
  const range = document.createRange(); range.setStart(root, 0); range.setEnd(node, offset)
  let length = 0
  for (const part of parts) {
    if (range.comparePoint(part.node, part.node.length) <= 0) length = part.end
    else break
  }
  return length
}
function sourceOffset(node: Node, offset: number) {
  if (node.nodeType !== Node.TEXT_NODE) return
  const span = node.parentElement?.closest<HTMLElement>('[data-comment-source]')
  if (!span || span.textContent !== node.textContent) return
  return Number(span.dataset.commentSource) + offset
}
export function anchorFromRange(root: HTMLElement, range: Range, source: string) {
  const index = textIndex(root)
  const start = pointOffset(root, range.startContainer, range.startOffset, index.parts), end = pointOffset(root, range.endContainer, range.endOffset, index.parts)
  if (start === undefined || end === undefined) return
  const quote = index.text.slice(start, end)
  const sourceStart = sourceOffset(range.startContainer, range.startOffset), sourceEnd = sourceOffset(range.endContainer, range.endOffset)
  const anchor = sourceStart !== undefined && sourceEnd !== undefined ? createAnchor(source, sourceStart, sourceEnd) : createAnchor(index.text, start, end, 'rendered')
  return anchor ? { quote, sourceExcerpt: anchor.kind === 'source' ? anchor.exact : '', anchor } : undefined
}
function rangeFromParts(parts: TextPart[], start: number, end: number) {
  const first = parts.find(part => part.end > start), last = [...parts].reverse().find(part => part.start < end)
  if (!first || !last) return
  const range = document.createRange(); range.setStart(first.node, Math.max(0, start - first.start)); range.setEnd(last.node, Math.min(last.node.length, end - last.start))
  return range
}
export function commentDomRange(root: HTMLElement, source: string, comment: NoteComment) {
  const index = textIndex(root)
  if (comment.anchor?.kind === 'rendered') {
    const resolved = resolveAnchor(index.text, comment.anchor)
    return resolved ? rangeFromParts(index.parts, resolved.start, resolved.end) : undefined
  }
  const anchor = comment.anchor
  const resolved = anchor ? resolveAnchor(source, anchor) : undefined
  if (anchor && !resolved) return
  if (resolved) {
    const spans = [...root.querySelectorAll<HTMLElement>('[data-comment-source]')]
    const first = spans.find(span => Number(span.dataset.commentSource) <= resolved.start && Number(span.dataset.commentEnd) > resolved.start)
    const last = [...spans].reverse().find(span => Number(span.dataset.commentSource) < resolved.end && Number(span.dataset.commentEnd) >= resolved.end)
    if (first?.firstChild && last?.firstChild) {
      const range = document.createRange(); range.setStart(first.firstChild, resolved.start - Number(first.dataset.commentSource)); range.setEnd(last.firstChild, resolved.end - Number(last.dataset.commentSource)); return range
    }
  }
  // Legacy comments and source selections containing syntax get a block pin rather than a guessed word.
  const line = commentLine(source, comment)
  const block = line && [...root.querySelectorAll<HTMLElement>('[data-source-start]')].find(node => Number(node.dataset.sourceStart) <= line && Number(node.dataset.sourceEnd) >= line)
  if (block) { const range = document.createRange(); range.selectNodeContents(block); return range }
}
export type PendingComment = { quote: string; sourceExcerpt: string; anchor?: CommentAnchor }

export function editorCommentPoint(editor: HTMLTextAreaElement) {
  const style = getComputedStyle(editor), bounds = editor.getBoundingClientRect(), mirror = document.createElement('div')
  mirror.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:border-box;'
  mirror.style.width = `${editor.clientWidth}px`
  for (const property of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'textIndent', 'tabSize'] as const) mirror.style[property] = style[property]
  mirror.append(document.createTextNode(editor.value.slice(0, editor.selectionStart)))
  const marker = document.createElement('span')
  marker.textContent = editor.value.slice(editor.selectionStart, editor.selectionEnd) || '\u200b'
  mirror.append(marker, document.createTextNode(editor.value.slice(editor.selectionEnd)))
  document.body.append(mirror)
  try {
    const rect = marker.getClientRects()[0] ?? marker.getBoundingClientRect(), origin = mirror.getBoundingClientRect()
    const top = Math.max(bounds.top + 4, Math.min(bounds.bottom - 24, bounds.top + rect.top - origin.top - editor.scrollTop))
    return { left: Math.max(bounds.left, Math.min(bounds.right - 24, bounds.left + rect.left - origin.left - editor.scrollLeft)), top, bottom: top + Math.min(rect.height || 20, 24) }
  } finally { mirror.remove() }
}
