import type { MarkdownDocument } from '../../types'
import type { DocumentFolder } from '../../lib/document-tree'
import { documentStats, searchDocuments } from '../../lib/documents'

export type CollectionFilter = 'all' | 'favorites' | 'recent'
export type CollectionOrder = 'name' | 'modified-desc' | 'modified-asc' | 'reading-asc' | 'reading-desc' | 'opened'
export const collectionOrders: { value: CollectionOrder; label: string }[] = [
  { value: 'name', label: 'Nome · A–Z' },
  { value: 'modified-desc', label: 'Atualizados recentemente' },
  { value: 'modified-asc', label: 'Atualizados há mais tempo' },
  { value: 'reading-asc', label: 'Leitura mais curta' },
  { value: 'reading-desc', label: 'Leitura mais longa' },
  { value: 'opened', label: 'Abertos recentemente' },
]

export function folderTrail(tree: DocumentFolder[], id: string | null): DocumentFolder[] {
  if (!id) return []
  for (const folder of tree) {
    if (folder.id === id) return [folder]
    const children = folderTrail(folder.folders, id)
    if (children.length) return [folder, ...children]
  }
  return []
}
function folderDocumentIds(folder: DocumentFolder): string[] {
  return [...folder.documents.map(doc => doc.id), ...folder.folders.flatMap(folderDocumentIds)]
}
export function collectionDocuments(documents: MarkdownDocument[], options: {
  query: string; filter: CollectionFilter; order: CollectionOrder
  favorites: string[]; recent: string[]; folder?: DocumentFolder
}) {
  const scope = options.folder ? new Set(folderDocumentIds(options.folder)) : null
  const favorites = new Set(options.favorites), opened = new Map(options.recent.map((id, index) => [id, index]))
  const filtered = searchDocuments(documents.filter(doc => (!scope || scope.has(doc.id))
    && (options.filter !== 'favorites' || favorites.has(doc.id))
    && (options.filter !== 'recent' || opened.has(doc.id))), options.query)
  // Compute reading estimates once per document rather than inside each comparison.
  const minutes = new Map(filtered.map(doc => [doc.id, documentStats(doc.content).minutes]))
  const byName = (a: MarkdownDocument, b: MarkdownDocument) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' }) || a.path.localeCompare(b.path)
  return filtered.sort((a, b) => {
    let comparison = 0
    switch (options.order) {
      case 'modified-desc': comparison = b.modified - a.modified; break
      case 'modified-asc': comparison = a.modified - b.modified; break
      case 'reading-asc': comparison = minutes.get(a.id)! - minutes.get(b.id)!; break
      case 'reading-desc': comparison = minutes.get(b.id)! - minutes.get(a.id)!; break
      case 'opened': comparison = (opened.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (opened.get(b.id) ?? Number.MAX_SAFE_INTEGER); break
    }
    return comparison || byName(a, b)
  })
}
