import { describe, expect, it } from 'vitest'
import { annotateCommentSource, createAnchor, editorOffset, lineSelection, parseAnchor, resolveAnchor, sourceOffset } from './comment-anchors'
import { commentLine, parseComments } from './workspace-model'

describe('inline comment anchors', () => {
  it('keeps a specific repeated word in unchanged content', () => {
    const source = 'nota e nota e nota', start = source.indexOf('nota', 1), anchor = createAnchor(source, start, start + 4)!
    expect(resolveAnchor(source, anchor)).toEqual({ start, end: start + 4 })
  })
  it('relocates the exact selection after edits outside its unchanged context', () => {
    const source = 'a'.repeat(90) + '\nMinha palavra especial.\n' + 'b'.repeat(90), start = source.indexOf('palavra')
    const anchor = createAnchor(source, start, start + 7)!
    expect(resolveAnchor('Introdução\n' + source, anchor)).toEqual({ start: start + 11, end: start + 18 })
  })
  it('refuses changed text or multiple matching contexts rather than moving a comment silently', () => {
    const source = 'a'.repeat(80) + 'palavra' + 'b'.repeat(80), start = source.indexOf('palavra'), anchor = createAnchor(source, start, start + 7)!
    expect(resolveAnchor(source.replace('palavra', 'outra'), anchor)).toBeUndefined()
    expect(resolveAnchor(source + '\n' + source, anchor)).toBeUndefined()
  })
  it('preserves boundary contexts for a whole-document selection', () => {
    const anchor = createAnchor('Uma nota.', 0, 9)!
    expect(resolveAnchor('Uma nota. e outra', anchor)).toBeUndefined()
  })
  it('keeps Windows line endings compatible with editor and renderer offsets', () => {
    const source = '# Nota\r\n\r\nUma palavra.\r\n', start = source.indexOf('palavra'), anchor = createAnchor(source, start, start + 7)!
    expect(resolveAnchor(source, anchor)).toEqual({ start, end: start + 7 })
    const lf = source.replace(/\r\n/g, '\n')
    expect(resolveAnchor(lf, anchor)).toEqual({ start: lf.indexOf('palavra'), end: lf.indexOf('palavra') + 7 })
    expect(sourceOffset(source, editorOffset(source, start))).toBe(start)
  })
  it('selects the cursor line, including the first, empty and CRLF lines', () => {
    expect(lineSelection('primeira\nsegunda', 2)).toEqual({ start: 0, end: 8 })
    expect(lineSelection('primeira\r\nsegunda', 12)).toEqual({ start: 10, end: 17 })
    expect(lineSelection('\nsegunda', 0)).toEqual({ start: 0, end: 0 })
  })
  it('validates anchors and keeps legacy comments readable', () => {
    const anchor = createAnchor('Uma palavra.', 4, 11)!
    expect(parseAnchor(anchor)).toEqual(anchor)
    expect(parseAnchor({ ...anchor, start: -1 })).toBeUndefined()
    expect(parseAnchor({ ...anchor, end: 20000000 })).toBeUndefined()
    expect(createAnchor(' ', 0, 1)).toBeUndefined()
    expect(createAnchor('texto', 1, 0)).toBeUndefined()
    const legacy = { id: 'old', quote: 'palavra', sourceExcerpt: 'Uma palavra.', text: 'Revisar', created: 1 }
    expect(parseComments(JSON.stringify([legacy]))[0].text).toBe('Revisar')
    expect(commentLine('# Nota\nUma palavra.', legacy)).toBe(2)
  })
  it('validates replies and derives the exact source line after restoring a comment', () => {
    const source = '# Nota\n\nUma palavra.', start = source.indexOf('palavra')
    const [comment] = parseComments(JSON.stringify([{ id: 'new', quote: 'palavra', sourceExcerpt: 'palavra', text: 'Revisar', created: 1,
      anchor: createAnchor(source, start, start + 7), replies: [{ id: 'ok', text: 'Resposta', created: 2 }, { id: 'bad', text: 42, created: 2 }] }]))
    expect(comment.replies).toHaveLength(1)
    expect(commentLine(source, comment)).toBe(3)
  })
  it('maps prose text inside formatting without wrapping decoded entities or code', () => {
    const raw = 'Uma **palavra** &amp; `x`'
    const tree = { type: 'root', children: [
      { type: 'element', tagName: 'strong', children: [{ type: 'text', value: 'palavra', position: { start: { offset: 6 }, end: { offset: 13 } } }] },
      { type: 'text', value: '&', position: { start: { offset: 16 }, end: { offset: 21 } } },
      { type: 'element', tagName: 'code', children: [{ type: 'text', value: 'x', position: { start: { offset: 23 }, end: { offset: 24 } } }] },
    ] }
    annotateCommentSource()(tree, { value: raw })
    expect(JSON.stringify(tree)).toContain('data-comment-source')
    expect(JSON.stringify(tree.children[1])).not.toContain('data-comment-source')
    expect(JSON.stringify(tree.children[2])).not.toContain('data-comment-source')
  })
})
