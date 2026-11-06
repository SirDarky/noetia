import type { MarkdownDocument } from '../types'

export interface DocumentFolder {
  id: string
  name: string
  path: string
  folders: DocumentFolder[]
  documents: MarkdownDocument[]
  count: number
}

// Canonical Windows paths may use \\?\ or \\?\UNC\ prefixes.
export function displayPath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/\/\?\/UNC\//i, '//').replace(/^\/\/\?\//, '').replace(/\/$/, '')
}
function pathKey(path: string) {
  return /^(?:[a-z]:|\/\/)/i.test(path) ? path.toLowerCase() : path
}
function parentPath(path: string) { const index = path.lastIndexOf('/'); return index < 0 ? '' : path.slice(0, index) }
function containsPath(root: string, path: string) {
  const base = pathKey(root), target = pathKey(path)
  return target.startsWith(`${base}/`)
}
const compare = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })

export function buildDocumentTree(documents: MarkdownDocument[], sourceRoots: string[] = []): DocumentFolder[] {
  const sources = [...new Set(sourceRoots.map(displayPath))].filter(Boolean).sort((a, b) => a.length - b.length)
  const roots = new Map<string, DocumentFolder>()
  const folders = new Map<string, DocumentFolder>()
  const seen = new Set<string>()
  for (const doc of documents) {
    if (seen.has(doc.id)) continue
    seen.add(doc.id)
    const path = displayPath(doc.path)
    const parent = parentPath(path)
    const absolute = /^(?:[a-z]:|\/)/i.test(path)
    const root = sources.find(source => containsPath(source, path)) ?? (absolute ? parent : parent ? path.split('/')[0] : '')
    const rootId = root ? pathKey(root) : 'loose-files'
    let folder = roots.get(rootId)
    if (!folder) {
      folder = { id: rootId, name: root.split('/').pop() || 'Arquivos avulsos', path: root, folders: [], documents: [], count: 0 }
      roots.set(rootId, folder)
      folders.set(rootId, folder)
    }
    folder.count++
    const relative = parent.slice(root.length).replace(/^\//, '')
    let currentPath = root
    for (const part of relative.split('/').filter(Boolean)) {
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const id = pathKey(currentPath)
      let child = folders.get(id)
      if (!child) {
        child = { id, name: part, path: currentPath, folders: [], documents: [], count: 0 }
        folders.set(id, child)
        folder.folders.push(child)
      }
      child.count++
      folder = child
    }
    folder.documents.push(doc)
  }
  const sort = (nodes: DocumentFolder[]) => {
    nodes.sort((a, b) => compare(a.name, b.name) || compare(a.path, b.path))
    for (const node of nodes) {
      node.documents.sort((a, b) => compare(a.name, b.name) || compare(a.path, b.path))
      sort(node.folders)
    }
  }
  const result = [...roots.values()]
  sort(result)
  return result
}

export function activeFolderIds(tree: DocumentFolder[], documentId: string): string[] {
  for (const folder of tree) {
    if (folder.documents.some(doc => doc.id === documentId)) return [folder.id]
    const ancestors = activeFolderIds(folder.folders, documentId)
    if (ancestors.length) return [folder.id, ...ancestors]
  }
  return []
}
