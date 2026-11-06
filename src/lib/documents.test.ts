import { describe, expect, it } from 'vitest'
import { headingId, relativePath, searchDocuments } from './documents'
import { assignHeadingIds } from './headings'

describe('paths from Markdown links', () => {
  it('normalizes canonical Windows and UNC prefixes before resolving local links and images', () => {
    expect(relativePath('\\\\?\\C:\\docs\\notas\\inicio.md', '../imagem.png')).toBe('C:/docs/imagem.png')
    expect(relativePath('\\\\?\\UNC\\servidor\\docs\\notas\\inicio.md', '../outra.md')).toBe('//servidor/docs/outra.md')
  })
  it('resolves relative Windows paths and ignores anchors', () => {
    expect(relativePath('C:\\docs\\guias\\inicio.md', '../exemplos/a%20b.md#secao')).toBe('C:/docs/exemplos/a b.md')
  })
  it('rejects external protocols and escaping a root', () => {
    expect(() => relativePath('pasta/a.md', '../../secreto.md')).toThrow()
    expect(() => relativePath('pasta/a.md', 'javascript:alert(1)')).toThrow()
    expect(() => relativePath('pasta/a.md', '//server/file.md')).toThrow()
  })
})
describe('document navigation', () => {
  it('gives repeated and accented headings distinct IDs', () => {
    const used = new Map<string, number>()
    expect(headingId('Configuração', used)).toBe('configuracao')
    expect(headingId('Configuração', used)).toBe('configuracao-1')
  })
  it('searches content as well as name, ignoring accent and case', () => {
    const docs = [{ id: '1', path: 'Downloads/a.md', name: 'a.md', content: 'Configuração do servidor', modified: 0 }]
    expect(searchDocuments(docs, 'CONFIGURACAO')).toHaveLength(1)
    expect(searchDocuments(docs, 'Downloads')).toHaveLength(1)
    expect(searchDocuments(docs, 'inexistente')).toHaveLength(0)
  })
  it('keeps heading IDs stable when rendering the same AST again', () => {
    const tree = { type: 'root', children: [
      { type: 'element', tagName: 'h2', properties: {}, children: [{ type: 'text', value: 'Configuração' }] },
      { type: 'element', tagName: 'h2', properties: {}, children: [{ type: 'text', value: 'Configuração' }] },
    ] }
    const assign = assignHeadingIds()
    assign(tree)
    const first = JSON.stringify(tree)
    expect(first).toContain('"id":"configuracao"')
    expect(first).toContain('"id":"configuracao-1"')
    assign(tree)
    expect(JSON.stringify(tree)).toBe(first)
  })
})
