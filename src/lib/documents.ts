import type { MarkdownDocument } from '../types'
import { displayPath } from './document-tree'

export function isMarkdown(path: string) { return /\.(md|markdown)$/i.test(path) }
export function documentStats(content: string) {
  const prose = content.replace(/```[\s\S]*?```/g, '').replace(/[#*_>`~|]/g, ' ')
  const words = prose.trim().split(/\s+/).filter(Boolean).length
  return { words, minutes: Math.max(1, Math.ceil(words / 220)), lines: content.split('\n').length }
}
export function normalized(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() }
export function searchDocuments(docs: MarkdownDocument[], query: string) {
  const needle = normalized(query.trim())
  return docs.filter(doc => !needle || normalized(doc.name + ' ' + doc.path + ' ' + doc.content).includes(needle))
}
export function relativePath(base: string, reference: string) {
  // Decode only the path; fragments/query parameters are navigation metadata.
  const clean = decodeURIComponent(reference.split(/[?#]/)[0]).replace(/\\/g, '/')
  if (/^[a-z]+:/i.test(clean) || clean.startsWith('//') || clean.startsWith('/')) throw new Error('Use um caminho relativo ao documento.')
  const parts = displayPath(base).split('/').slice(0, -1)
  for (const part of clean.split('/')) {
    if (part === '..') { if (parts.length <= 1) throw new Error('Caminho fora da pasta.'); parts.pop() }
    else if (part && part !== '.') parts.push(part)
  }
  return parts.join('/')
}
export function headingId(text: string, used: Map<string, number>) {
  const root = normalized(text).replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-') || 'secao'
  const count = used.get(root) ?? 0
  used.set(root, count + 1)
  return count ? `${root}-${count}` : root
}
