import type { NoteDraft } from './workspace-model'

// Retained when a reader tab unmounts; disk-backed drafts may exceed WebView storage.
export const sessionDrafts = new Map<string, NoteDraft>()
export const volatileDrafts = new Set<string>()
export const volatileDraftMessage = 'Há um rascunho guardado apenas nesta sessão. Volte à nota e salve o Markdown antes de fechar o Noetia.'
