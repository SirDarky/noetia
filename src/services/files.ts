import { invoke, isTauri } from '@tauri-apps/api/core'
import type { MarkdownDocument } from '../types'
import { isMarkdown, relativePath } from '../lib/documents'
import { loadAsset, loadDocuments, storeAsset, storeDocument, updateDocument } from '../lib/storage'

export const native = isTauri()
export async function libraryRoots(): Promise<string[]> {
  return native ? invoke('library_roots') : []
}
export async function saveDocument(doc: MarkdownDocument, content: string, expectedContent: string): Promise<MarkdownDocument> {
  if (new TextEncoder().encode(content).length > 8 * 1024 * 1024) throw new Error('Limite de 8 MB por documento.')
  return native ? invoke('save_document', { path: doc.path, content, expectedContent }) : updateDocument(doc, content, expectedContent)
}
export async function restoreLibrary(): Promise<MarkdownDocument[]> {
  return native ? invoke('restore_library') : loadDocuments()
}
export async function selectDocuments(folder = false): Promise<MarkdownDocument[]> {
  if (native) return invoke(folder ? 'pick_folder' : 'pick_documents')
  // Browser fallback imports real files, with copies kept in this browser's local database.
  return new Promise((resolve, reject) => {
    const input = document.createElement('input'); input.type = 'file'; input.multiple = true
    input.style.display = 'none'
    document.body.appendChild(input)
    if (folder) input.setAttribute('webkitdirectory', '')
    else input.accept = '.md,.markdown'
    input.oncancel = () => { input.remove(); resolve([]) }
    input.onchange = async () => {
      try {
        const files = [...(input.files ?? [])]
        const docs: MarkdownDocument[] = []
        for (const file of files) {
          const path = file.webkitRelativePath || file.name
          if (isMarkdown(path)) {
            if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name}: limite de 8 MB por documento.`)
            const doc = { id: `web:${path}`, path, name: file.name, content: await file.text(), modified: file.lastModified }
            await storeDocument(doc); docs.push(doc)
          } else if (folder && /\.(png|jpe?g|gif|webp)$/i.test(path) && file.size < 12 * 1024 * 1024) await storeAsset(path, file)
        }
        resolve(docs)
      } catch (error) { reject(error) } finally { input.remove() }
    }
    input.click()
  })
}
export async function importDropped(files: File[]): Promise<MarkdownDocument[]> {
  if (native) return [] // Native paths are received through the Tauri window event.
  const docs: MarkdownDocument[] = []
  for (const file of files.filter(file => isMarkdown(file.name))) {
    if (file.size > 8 * 1024 * 1024) throw new Error('Limite de 8 MB por documento.')
    const doc = { id: `web:${file.name}`, path: file.name, name: file.name, content: await file.text(), modified: file.lastModified }
    await storeDocument(doc); docs.push(doc)
  }
  return docs
}
export async function resolveDocument(base: MarkdownDocument, href: string, library: MarkdownDocument[]): Promise<MarkdownDocument> {
  const path = relativePath(base.path, href)
  const found = library.find(doc => doc.path.replace(/\\/g, '/') === path)
  if (native) return invoke('read_document', { path })
  if (found) return found
  throw new Error('Adicione a pasta que contém esse documento para abrir o link.')
}
export async function localImage(base: string, href: string) {
  const path = relativePath(base, href)
  if (native) return invoke<string>('read_image', { path })
  const blob = await loadAsset(path)
  if (!blob) throw new Error('Adicione a pasta do documento para carregar as imagens.')
  return URL.createObjectURL(blob)
}
