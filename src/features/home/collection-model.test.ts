import { describe, expect, it } from 'vitest'
import { buildDocumentTree } from '../../lib/document-tree'
import type { MarkdownDocument } from '../../types'
import { collectionDocuments, folderTrail, type CollectionOrder } from './collection-model'

const make = (id: string, path: string, modified: number, words: number): MarkdownDocument => ({ id, path, name: path.split('/').at(-1)!, modified, content: 'ideia '.repeat(words) })
const docs = [make('a', '//?/C:/projeto/Docs/backlog/nota10.md', 300, 441),
  make('b', 'C:/projeto/Docs/backlog/nota2.md', 100, 221),
  make('c', 'C:/projeto/Docs/produto/visão.md', 200, 30),
  make('d', 'C:/outro/Docs/nota2.md', 400, 30)]
const tree = buildDocumentTree(docs, ['C:/projeto/Docs', 'C:/outro/Docs'])
const root = tree.find(folder => folder.id === 'c:/projeto/docs')!
const defaults = { query: '', filter: 'all' as const, order: 'name' as CollectionOrder, favorites: ['b', 'd'], recent: ['c', 'a'] }

describe('home library scope and ordering', () => {
  it('preserves the imported Docs root and includes nested documents without leaking another Docs folder', () => {
    expect(root.name).toBe('Docs')
    expect(root.folders.map(folder => folder.name)).toEqual(['backlog', 'produto'])
    expect(collectionDocuments(docs, { ...defaults, folder: root }).map(doc => doc.id)).toEqual(['b', 'a', 'c'])
    expect(folderTrail(tree, root.folders[0].id).map(folder => folder.name)).toEqual(['Docs', 'backlog'])
    expect(folderTrail(tree, 'missing')).toEqual([])
  })
  it('combines subfolder scope, content search and favorites independently', () => {
    const folder = root.folders[0]
    expect(collectionDocuments(docs, { ...defaults, folder, query: 'IDEIA', filter: 'favorites' }).map(doc => doc.id)).toEqual(['b'])
    expect(collectionDocuments(docs, { ...defaults, folder, query: 'visao' })).toEqual([])
    expect(collectionDocuments(docs, { ...defaults, query: 'visao' }).map(doc => doc.id)).toEqual(['c'])
  })
  it('orders by saved modification dates in both directions without mutating the library', () => {
    expect(collectionDocuments(docs, { ...defaults, order: 'modified-desc' }).map(doc => doc.id)).toEqual(['d', 'a', 'c', 'b'])
    expect(collectionDocuments(docs, { ...defaults, order: 'modified-asc' }).map(doc => doc.id)).toEqual(['b', 'c', 'a', 'd'])
    expect(docs.map(doc => doc.id)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('orders by estimated reading minutes with deterministic name ties', () => {
    expect(collectionDocuments(docs, { ...defaults, order: 'reading-asc' }).map(doc => doc.id)).toEqual(['d', 'c', 'b', 'a'])
    expect(collectionDocuments(docs, { ...defaults, order: 'reading-desc' }).map(doc => doc.id)).toEqual(['a', 'b', 'd', 'c'])
  })
  it('distinguishes last-opened history from modification date and puts unopened notes last', () => {
    expect(collectionDocuments(docs, { ...defaults, order: 'opened' }).map(doc => doc.id)).toEqual(['c', 'a', 'd', 'b'])
    expect(collectionDocuments(docs, { ...defaults, order: 'opened', filter: 'recent', folder: root.folders[0] }).map(doc => doc.id)).toEqual(['a'])
  })
  it('supports the loose-files group without accidentally selecting the whole library', () => {
    const loose = make('loose', 'nota.md', 0, 1), all = [...docs, loose]
    const folder = buildDocumentTree(all).find(item => item.id === 'loose-files')!
    expect(collectionDocuments(all, { ...defaults, folder }).map(doc => doc.id)).toEqual(['loose'])
  })
})
