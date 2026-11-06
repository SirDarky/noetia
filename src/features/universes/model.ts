import { unified } from 'unified'
import remarkParse from 'remark-parse'
import type { MarkdownDocument } from '../../types'
import { buildDocumentTree, displayPath, type DocumentFolder } from '../../lib/document-tree'

export interface Universe {
  id: string
  name: string
  description: string
  folder: string | null
  documentIds: string[]
  portableFolder?: string
}
export interface NoteReference {
  sourceId: string
  targetId?: string
  href: string
  label: string
  kind: 'markdown' | 'wiki'
  status: 'resolved' | 'missing' | 'ambiguous' | 'external'
  candidates: string[]
  line: number
  section: string
  fragment: string
}
interface Node {
  type: string; value?: string; url?: string; identifier?: string; children?: Node[]
  position?: { start: { line: number; offset?: number }; end: { offset?: number } }
}
function wikiTokens(node: Node, source?: string) {
  const raw = source !== undefined && node.position?.start.offset !== undefined && node.position.end.offset !== undefined
    ? source.slice(node.position.start.offset, node.position.end.offset) : node.value ?? ''
  return [...raw.matchAll(/(?<!!)\[\[([^\]\n]+)\]\]/g)].map(match => ({
    target: match[1], index: match.index ?? 0,
    valid: (raw.slice(0, match.index).match(/\\+$/)?.[0].length ?? 0) % 2 === 0,
    line: (node.position?.start.line ?? 1) + raw.slice(0,match.index).split('\n').length - 1,
  }))
}
const parser = unified().use(remarkParse)
export const wikiPrefix = '__noetia_wiki__/'
export const cleanPath = (path: string) => displayPath(path)
export const folderOf = (doc: MarkdownDocument) => cleanPath(doc.path).split('/').slice(0, -1).join('/')
const titleOf = (doc: MarkdownDocument) => doc.name.replace(/\.(md|markdown)$/i, '')
const samePath = (a: string, b: string) => a === b || (/^(?:[a-z]:|\/\/)/i.test(a) && a.toLowerCase() === b.toLowerCase())

export function universeDocuments(universe: Universe, docs: MarkdownDocument[]) {
  if (universe.portableFolder) return docs.filter(doc => universe.documentIds.includes(doc.id) || (universe.portableFolder === 'portable:' ? doc.id.startsWith('portable:') : doc.id.startsWith(universe.portableFolder + '/')))
  return docs.filter(doc => universe.documentIds.includes(doc.id) || (universe.folder !== null && (
    universe.folder === '' ? folderOf(doc) === '' : samePath(folderOf(doc), universe.folder) ||
      samePath(cleanPath(doc.path).slice(0, universe.folder.length + 1), universe.folder + '/')
  )))
}
function portableBase(docs: MarkdownDocument[]) {
  const doc = docs.find(doc => doc.id.startsWith('portable:') && cleanPath(doc.path).endsWith('/' + doc.id.slice(9)))
  return doc ? cleanPath(doc.path).slice(0, -doc.id.slice(9).length - 1) : undefined
}
export function portableFolderKey(folder: string | null, docs: MarkdownDocument[]) {
  const root = portableBase(docs)
  if (!root || folder === null) return
  const path = cleanPath(folder)
  if (samePath(path, root)) return 'portable:'
  if (samePath(path.slice(0, root.length + 1), root + '/')) return 'portable:' + path.slice(root.length + 1)
}
export function resolveUniverseFolder(universe: Universe, docs: MarkdownDocument[]) {
  const root = universe.portableFolder && portableBase(docs)
  return root ? root + (universe.portableFolder!.slice(9) ? '/' + universe.portableFolder!.slice(9) : '') : universe.folder
}
export function universeFolders(docs: MarkdownDocument[], roots: string[] = []) {
  const flatten = (folders: DocumentFolder[]): string[] => folders.flatMap(folder => [folder.path, ...flatten(folder.folders)])
  return flatten(buildDocumentTree(docs, roots))
}
export function suggestedUniverses(docs: MarkdownDocument[], roots: string[] = []): Universe[] {
  return buildDocumentTree(docs, roots).map(folder => ({
    id: `folder:${folder.path}`, name: folder.name,
    description: folder.path ? 'Uma constelação a partir desta pasta.' : 'Notas que você trouxe para a biblioteca.',
    folder: folder.path, documentIds: [], portableFolder: portableFolderKey(folder.path, docs),
  }))
}
export function parseUniverses(value: string | null): Universe[] | null {
  try {
    if (value === null) return null
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return null
    const ids = new Set<string>()
    const result: Universe[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const u = item as Record<string, unknown>
      if (typeof u.id !== 'string' || !u.id || ids.has(u.id) || typeof u.name !== 'string' || !u.name.trim()) continue
      ids.add(u.id)
      const portableFolder = typeof u.portableFolder === 'string' && u.portableFolder.startsWith('portable:') && u.portableFolder.length < 2048 && !u.portableFolder.slice(9).split('/').some(part => part === '..' || part === '.') ? u.portableFolder : undefined
      result.push({ id: u.id, name: u.name.slice(0, 80), description: typeof u.description === 'string' ? u.description.slice(0, 300) : '', portableFolder,
        folder: typeof u.folder === 'string' ? cleanPath(u.folder) : null,
        documentIds: Array.isArray(u.documentIds) ? [...new Set(u.documentIds.filter((id): id is string => typeof id === 'string'))] : [] })
    }
    return result
  } catch { return null }
}
function decode(value: string) { try { return decodeURIComponent(value) } catch { return value } }
function pathFrom(base: string, reference: string) {
  const parts = cleanPath(base).split('/').slice(0, -1)
  for (const part of reference.replace(/\\/g, '/').split('/')) {
    if (part === '..') { if (!parts.length || (parts.length === 1 && /^[a-z]:$/i.test(parts[0]))) return null; parts.pop() }
    else if (part && part !== '.') parts.push(part)
  }
  return parts.join('/')
}
export function resolveReference(source: MarkdownDocument, href: string, kind: NoteReference['kind'], docs: MarkdownDocument[]) {
  const [rawPath, ...anchor] = href.trim().split('#')
  const fragment = decode(anchor.join('#'))
  const path = decode(kind === 'markdown' ? rawPath.split('?')[0] : rawPath).replace(/\\/g, '/')
  if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('//') || path.startsWith('/'))
    return { status: 'external' as const, candidates: [], fragment }
  if (!path) return { status: 'resolved' as const, targetId: source.id, candidates: [source.id], fragment }
  let matches: MarkdownDocument[] = []
  if (kind === 'markdown') {
    const resolved = pathFrom(source.path, path)
    if (resolved !== null) matches = docs.filter(doc => samePath(cleanPath(doc.path), resolved))
  } else {
    const withoutExtension = path.replace(/\.(md|markdown)$/i, '')
    const relative = pathFrom(source.path, withoutExtension)
    const stem = (doc: MarkdownDocument) => cleanPath(doc.path).replace(/\.(md|markdown)$/i, '')
    matches = docs.filter(doc => relative !== null && samePath(stem(doc), relative))
    if (!matches.length) matches = docs.filter(doc => path.includes('/')
      ? samePath(stem(doc), withoutExtension) || stem(doc).endsWith('/' + withoutExtension)
      : titleOf(doc) === withoutExtension)
    if (!matches.length && !path.includes('/')) matches = docs.filter(doc => titleOf(doc).toLowerCase() === withoutExtension.toLowerCase())
  }
  return { status: matches.length === 1 ? 'resolved' as const : matches.length ? 'ambiguous' as const : 'missing' as const,
    targetId: matches.length === 1 ? matches[0].id : undefined, candidates: matches.map(doc => doc.id), fragment }
}
function nodeText(node: Node): string { return node.value ?? node.children?.map(nodeText).join('') ?? '' }
export function documentExcerpt(content: string) {
  const tree = parser.parse(content) as Node
  return (tree.children?.filter(node => !['code', 'html', 'definition', 'thematicBreak'].includes(node.type)).map(nodeText).join(' ') ?? '')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target: string, alias?: string) => alias || target)
    .replace(/\s+/g, ' ').trim().slice(0, 160)
}
export function indexReferences(docs: MarkdownDocument[]): NoteReference[] {
  const result: NoteReference[] = []
  for (const source of docs) {
    const tree = parser.parse(source.content) as Node
    const definitions = new Map<string, string>()
    function definitionsIn(node: Node) {
      if (node.type === 'definition' && node.identifier && node.url) definitions.set(node.identifier.toLowerCase(), node.url)
      node.children?.forEach(definitionsIn)
    }
    definitionsIn(tree)
    let section = ''
    function add(href: string, label: string, kind: NoteReference['kind'], line: number) {
      // Graph only Markdown documents; images, remote URLs and other assets are not stars.
      if (kind === 'markdown' && !/\.(md|markdown)(?:[?#]|$)/i.test(href) && !href.startsWith('#')) return
      result.push({ sourceId: source.id, href, label, kind, line, section, ...resolveReference(source, href, kind, docs) })
    }
    function visit(node: Node) {
      if (['code', 'inlineCode', 'html', 'image', 'imageReference', 'definition'].includes(node.type)) return
      if (node.type === 'heading') section = nodeText(node)
      if (node.type === 'link') { if (node.url) add(node.url, nodeText(node), 'markdown', node.position?.start.line ?? 1); return }
      if (node.type === 'linkReference') {
        const url = definitions.get(node.identifier?.toLowerCase() ?? '')
        if (url) add(url, nodeText(node), 'markdown', node.position?.start.line ?? 1)
        return
      }
      if (node.type === 'text' && node.value) {
        for (const token of wikiTokens(node,source.content)) {
          if (!token.valid) continue
          const [href, ...alias] = token.target.split('|')
          add(href, alias.join('|') || href, 'wiki', token.line)
        }
      }
      node.children?.forEach(visit)
    }
    visit(tree)
  }
  return result
}

export function connectedDocumentIds(start: string, docs: MarkdownDocument[], references: NoteReference[]) {
  const available = new Set(docs.map(doc=>doc.id)), visited = new Set<string>(), queue = [start]
  const adjacency = new Map<string, Set<string>>()
  for (const ref of references) {
    if (ref.status !== 'resolved' || !ref.targetId) continue
    if (!available.has(ref.sourceId) || !available.has(ref.targetId)) continue
    if (!adjacency.has(ref.sourceId)) adjacency.set(ref.sourceId,new Set())
    if (!adjacency.has(ref.targetId)) adjacency.set(ref.targetId,new Set())
    adjacency.get(ref.sourceId)!.add(ref.targetId); adjacency.get(ref.targetId)!.add(ref.sourceId)
  }
  for (let i=0;i<queue.length;i++) {
    const id=queue[i]; if(visited.has(id)||!available.has(id))continue
    visited.add(id); for(const next of adjacency.get(id)??[])if(!visited.has(next))queue.push(next)
  }
  return [...visited]
}

// The same parser convention is used by the reader, so stars and written links agree.
export function remarkWikiLinks() {
  return (tree: Node, file?: { value?: unknown }) => {
    const source = typeof file?.value === 'string' ? file.value : undefined
    function visit(node: Node) {
      if (!node.children || ['link', 'code', 'inlineCode', 'html'].includes(node.type)) return
      node.children = node.children.flatMap(child => {
        if (child.type !== 'text' || !child.value) { visit(child); return [child] }
        const parts: Node[] = []; let previous = 0
        const tokens = wikiTokens(child,source)
        for (const match of child.value.matchAll(/(?<!!)\[\[([^\]\n]+)\]\]/g)) {
          const rawIndex = tokens.findIndex(token => token.target === match[1])
          if (rawIndex < 0 || !tokens.splice(rawIndex,1)[0].valid) continue
          const start = match.index ?? 0, [target, ...alias] = match[1].split('|')
          if (start > previous) parts.push({ type: 'text', value: child.value.slice(previous, start) })
          parts.push({ type: 'link', url: wikiPrefix + encodeURIComponent(target), children: [{ type: 'text', value: alias.join('|') || target }] })
          previous = start + match[0].length
        }
        if (previous < child.value.length) parts.push({ type: 'text', value: child.value.slice(previous) })
        // Untouched text must keep its original position for comments and source mapping.
        return previous === 0 ? [child] : parts
      })
    }
    visit(tree)
  }
}
