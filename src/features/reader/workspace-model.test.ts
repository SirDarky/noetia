import { describe, expect, it } from 'vitest'
import { commentLine, documentBreadcrumbs, folderContains, formatSelection, parseComments, parseDraft, preserveLineEndings } from './workspace-model'
import type { MarkdownDocument } from '../../types'

const doc: MarkdownDocument = { id: 'note', name: 'BACKLOG_FRONTEND.md', path: '\\\\?\\C:\\Workspace\\fluxa\\docs\\backlog\\BACKLOG_FRONTEND.md', content: '', modified: 0 }
describe('reader workspace', () => {
  it('starts breadcrumbs at the added folder and preserves subfolder destinations', () => {
    expect(documentBreadcrumbs(doc, ['C:/Workspace/fluxa/docs'])).toEqual([
      { name: 'docs', path: 'C:/Workspace/fluxa/docs' },
      { name: 'backlog', path: 'C:/Workspace/fluxa/docs/backlog' },
    ])
  })
  it('uses path boundaries and Windows case rules for folder universes', () => {
    expect(folderContains('C:/docs', '\\\\?\\c:\\DOCS\\backlog\\a.md')).toBe(true)
    expect(folderContains('C:/docs', 'C:/docs-extra/a.md')).toBe(false)
    expect(folderContains('docs', 'docs/guias/a.md')).toBe(true)
    expect(folderContains('docs', 'Docs/a.md')).toBe(false)
  })
  it('uses imported relative folders or a short fallback when no root is registered', () => {
    expect(documentBreadcrumbs({ ...doc, path: 'docs/backlog/a.md' }, []).map(part => part.name)).toEqual(['docs', 'backlog'])
    expect(documentBreadcrumbs({ ...doc, path: 'a.md' }, [])).toEqual([])
    expect(documentBreadcrumbs(doc, []).map(part => part.name)).toEqual(['backlog'])
  })
  it('preserves CRLF and does not force conversion on mixed or LF documents', () => {
    expect(preserveLineEndings('# Nota\n\nTexto\n', '# Nota\r\nTexto\r\n')).toBe('# Nota\r\n\r\nTexto\r\n')
    expect(preserveLineEndings('a\nb', 'a\nb')).toBe('a\nb')
    expect(preserveLineEndings('a\nb', 'a\r\nb\nc')).toBe('a\nb')
  })
  it('formats only the selected range and puts the caret inside inserted markup', () => {
    expect(formatSelection('Olá mundo!', 4, 9, 'bold')).toEqual({ text: 'Olá **mundo**!', start: 6, end: 11 })
    expect(formatSelection('ab', 1, 1, 'italic')).toEqual({ text: 'a*texto*b', start: 2, end: 7 })
    expect(formatSelection('um\ndois', 0, 7, 'list').text).toBe('- um\n- dois')
    expect(formatSelection('fim', 0, 0, 'append')).toEqual({ text: 'fim\n\n', start: 5, end: 5 })
  })
  it('keeps draft baselines and rejects malformed local metadata', () => {
    expect(parseDraft('{"text":"nova","baseContent":"original"}')).toEqual({ text: 'nova', baseContent: 'original' })
    expect(parseDraft('{"text":1}')).toBeNull()
    expect(parseDraft('bad')).toBeNull()
    expect(parseComments('[{"id":"a"}]')).toEqual([])
    expect(parseComments('bad')).toEqual([])
  })
  it('relocates comments after preceding edits while refusing missing or ambiguous blocks', () => {
    const comment = { id: 'a', quote: 'Trecho', sourceExcerpt: 'Trecho original', text: 'Revisar', created: 1 }
    expect(commentLine('# Nota\n\nTrecho original', comment)).toBe(3)
    expect(commentLine('Texto novo\n# Nota\n\nTrecho original', comment)).toBe(4)
    expect(commentLine('Trecho mudou', comment)).toBeUndefined()
    expect(commentLine('Trecho original\nTrecho original', comment)).toBeUndefined()
  })
})
