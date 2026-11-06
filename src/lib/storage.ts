import type { MarkdownDocument } from '../types'

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('noetia-preview', 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('documents', { keyPath: 'id' })
      request.result.createObjectStore('assets')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
export async function storeDocument(doc: MarkdownDocument) {
  const db = await database()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('documents', 'readwrite'); tx.objectStore('documents').put(doc)
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error)
  }).finally(() => db.close())
}
export async function loadDocuments(): Promise<MarkdownDocument[]> {
  const db = await database()
  return new Promise<MarkdownDocument[]>((resolve, reject) => {
    const request = db.transaction('documents').objectStore('documents').getAll()
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
  }).finally(() => db.close())
}
export async function updateDocument(doc: MarkdownDocument, content: string, expectedContent: string): Promise<MarkdownDocument> {
  const db = await database()
  return new Promise<MarkdownDocument>((resolve, reject) => {
    const tx = db.transaction('documents', 'readwrite'), store = tx.objectStore('documents')
    const request = store.get(doc.id)
    let next: MarkdownDocument | undefined, failure: Error | undefined
    request.onsuccess = () => {
      const current: MarkdownDocument | undefined = request.result
      if (!current || current.content !== expectedContent) {
        failure = new Error('O arquivo mudou fora do editor. Compare as versões antes de salvar.'); tx.abort(); return
      }
      next = { ...current, content, modified: Date.now() }; store.put(next)
    }
    tx.oncomplete = () => resolve(next!)
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('Não foi possível salvar.'))
    tx.onerror = () => reject(tx.error)
  }).finally(() => db.close())
}
export async function storeAsset(path: string, file: Blob) {
  const db = await database()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('assets', 'readwrite'); tx.objectStore('assets').put(file, path)
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error)
  }).finally(() => db.close())
}
export async function loadAsset(path: string): Promise<Blob | undefined> {
  const db = await database()
  return new Promise<Blob | undefined>((resolve, reject) => {
    const request = db.transaction('assets').objectStore('assets').get(path)
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
  }).finally(() => db.close())
}
