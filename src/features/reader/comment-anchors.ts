export interface CommentAnchor {
  version: 1
  kind: 'source' | 'rendered'
  start: number
  end: number
  exact: string
  prefix: string
  suffix: string
  fingerprint: string
}
export const editorOffset = (source: string, rawOffset: number) => source.slice(0, rawOffset).replace(/\r\n/g, '\n').length
export function sourceOffset(source: string, offset: number) {
  let raw = 0, count = 0
  while (raw < source.length && count < offset) { if (source[raw] === '\r' && source[raw + 1] === '\n') raw++; raw++; count++ }
  return raw
}
export function textFingerprint(text: string) {
  let a = 2166136261, b = 5381
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ text.charCodeAt(i) }
  return `${text.length}:${a >>> 0}:${b >>> 0}`
}
export function createAnchor(text: string, start: number, end: number, kind: CommentAnchor['kind'] = 'source'): CommentAnchor | undefined {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > text.length || end <= start || end - start > 4000 || !text.slice(start, end).trim()) return
  if (kind === 'source') { start = editorOffset(text, start); end = editorOffset(text, end); text = text.replace(/\r\n/g, '\n') }
  return { version: 1, kind, start, end, exact: text.slice(start, end), prefix: text.slice(Math.max(0, start - 64), start), suffix: text.slice(end, end + 64), fingerprint: textFingerprint(text) }
}
export function parseAnchor(value: unknown): CommentAnchor | undefined {
  if (!value || typeof value !== 'object') return
  const a = value as Record<string, unknown>
  if (a.version !== 1 || (a.kind !== 'source' && a.kind !== 'rendered') || !Number.isInteger(a.start) || !Number.isInteger(a.end)
    || typeof a.start !== 'number' || typeof a.end !== 'number' || a.start < 0 || a.end <= a.start || a.end > 8 * 1024 * 1024
    || typeof a.exact !== 'string' || !a.exact.trim() || a.exact.length > 4000 || a.end - a.start !== a.exact.length
    || typeof a.prefix !== 'string' || a.prefix.length > 64 || typeof a.suffix !== 'string' || a.suffix.length > 64
    || typeof a.fingerprint !== 'string' || a.fingerprint.length > 80) return
  return { version: 1, kind: a.kind, start: a.start, end: a.end, exact: a.exact, prefix: a.prefix, suffix: a.suffix, fingerprint: a.fingerprint }
}
// Offsets identify repeated words only while the complete text is unchanged.
// After edits, require one unchanged context match; never guess between identical occurrences.
export function resolveAnchor(text: string, anchor: CommentAnchor): { start: number; end: number } | undefined {
  const original = text
  if (anchor.kind === 'source') text = text.replace(/\r\n/g, '\n')
  const offsets = (start: number, end: number) => anchor.kind === 'source' ? { start: sourceOffset(original, start), end: sourceOffset(original, end) } : { start, end }
  if (text.slice(anchor.start, anchor.end) === anchor.exact && textFingerprint(text) === anchor.fingerprint) return offsets(anchor.start, anchor.end)
  const needle = anchor.prefix + anchor.exact + anchor.suffix
  const index = text.indexOf(needle)
  if (index < 0 || text.indexOf(needle, index + 1) >= 0) return
  const start = index + anchor.prefix.length, end = start + anchor.exact.length
  if ((!anchor.prefix && start !== 0) || (!anchor.suffix && end !== text.length)) return
  return offsets(start, end)
}
export function lineSelection(text: string, caret: number) {
  const start = caret === 0 ? 0 : text.lastIndexOf('\n', caret - 1) + 1
  const next = text.indexOf('\n', caret), end = next < 0 ? text.length : next
  return { start, end: text[end - 1] === '\r' ? end - 1 : end }
}

interface SourceNode { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: SourceNode[]; position?: { start: { offset?: number }; end: { offset?: number } } }
// Preserve a reversible mapping for prose text, including text inside emphasis and links.
// Decoded entities/escapes and syntax-highlighted code use rendered-text anchors instead.
export function annotateCommentSource() {
  return (tree: SourceNode, file: { value: unknown }) => {
    const source = String(file.value)
    function visit(node: SourceNode) {
      if (!node.children || ['pre', 'code', 'svg'].includes(node.tagName ?? '')) return
      node.children = node.children.map(child => {
        const start = child.position?.start.offset, end = child.position?.end.offset
        if (child.type === 'text' && start !== undefined && end !== undefined && child.value && source.slice(start, end) === child.value) {
          return { type: 'element', tagName: 'span', properties: { 'data-comment-source': start, 'data-comment-end': end }, children: [child] }
        }
        visit(child); return child
      })
    }
    visit(tree)
  }
}
