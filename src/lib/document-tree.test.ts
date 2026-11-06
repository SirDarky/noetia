import { describe, expect, it } from 'vitest'
import { activeFolderIds, buildDocumentTree, displayPath } from './document-tree'
import type { MarkdownDocument } from '../types'

function doc(path: string, id = path): MarkdownDocument {
  return { id, path, name: path.replace(/\\/g, '/').split('/').pop()!, content: '', modified: 0 }
}

describe('library folder hierarchy', () => {
  it('starts at registered roots, preserves nested folders and counts descendants', () => {
    const tree = buildDocumentTree([
      doc('C:\\Workspace\\morada\\README.md'),
      doc('C:\\Workspace\\morada\\docs\\backend\\api.md'),
      doc('C:\\Workspace\\morada\\docs\\guia.md'),
      doc('C:\\Workspace\\desafio\\tarefas.md'),
    ], ['C:\\Workspace\\morada', 'C:\\Workspace\\desafio'])
    expect(tree.map(folder => folder.name)).toEqual(['desafio', 'morada'])
    expect(tree[1].count).toBe(3)
    expect(tree[1].documents.map(file => file.name)).toEqual(['README.md'])
    expect(tree[1].folders[0].name).toBe('docs')
    expect(tree[1].folders[0].count).toBe(2)
    expect(tree[1].folders[0].folders[0].name).toBe('backend')
  })
  it('normalizes extended Windows paths and overlapping registrations without flattening subfolders', () => {
    const path = '\\\\?\\C:\\projeto\\Docs\\nota.md'
    const tree = buildDocumentTree([doc(path)], ['C:\\projeto\\Docs', '\\\\?\\c:\\projeto'])
    expect(displayPath(path)).toBe('C:/projeto/Docs/nota.md')
    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe('projeto')
    expect(tree[0].folders[0].name).toBe('Docs')
    expect(activeFolderIds(tree, path)).toEqual(['c:/projeto', 'c:/projeto/docs'])
  })
  it('handles UNC paths and separates folders with the same name in different sources', () => {
    const tree = buildDocumentTree([
      doc('\\\\?\\UNC\\servidor\\acervo\\docs\\a.md'),
      doc('C:\\outra\\docs\\b.md'),
    ], ['\\\\servidor\\acervo\\docs', 'C:\\outra\\docs'])
    expect(tree).toHaveLength(2)
    expect(tree.map(folder => folder.name)).toEqual(['docs', 'docs'])
    expect(new Set(tree.map(folder => folder.id)).size).toBe(2)
    expect(tree.map(folder => folder.count)).toEqual([1, 1])
  })
  it('keeps loose files, browser folders, and the example organized without fabricating folders', () => {
    const tree = buildDocumentTree([doc('nota.md'), doc('Exemplos/inicio.md'), doc('morada/docs/guia.md')])
    expect(tree.map(folder => folder.name)).toEqual(['Arquivos avulsos', 'Exemplos', 'morada'])
    expect(tree[0].documents[0].name).toBe('nota.md')
    expect(tree[0].folders).toEqual([])
    expect(tree[2].folders[0].documents[0].name).toBe('guia.md')
  })
  it('matches folder roots at path boundaries and keeps duplicate filenames separate', () => {
    const tree = buildDocumentTree([doc('C:/projeto/docs/a.md'), doc('C:/projeto-extra/docs/a.md')], ['C:/projeto'])
    expect(tree).toHaveLength(2)
    expect(tree.reduce((count, folder) => count + folder.count, 0)).toBe(2)
    expect(tree.find(folder => folder.name === 'projeto')?.count).toBe(1)
  })
  it('preserves original document identity through sorting, filtering and ancestor lookup', () => {
    const a = doc('morada/docs/nota10.md'), b = doc('morada/docs/nota2.md')
    const tree = buildDocumentTree([a, b, a])
    expect(tree[0].folders[0].documents).toEqual([b, a])
    const filtered = buildDocumentTree([a])
    expect(activeFolderIds(filtered, a.id)).toEqual(['morada', 'morada/docs'])
    expect(filtered[0].folders[0].documents[0]).toBe(a)
    expect(activeFolderIds(filtered, 'missing')).toEqual([])
    expect(buildDocumentTree([])).toEqual([])
  })
})
