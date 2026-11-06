import type { AsciiArtId } from './features/home/artworks'
import type { ThemeId } from './lib/themes'

export interface MarkdownDocument {
  id: string
  path: string
  name: string
  content: string
  modified: number
}
export interface Preferences { theme: ThemeId; motion: boolean; readingWidth: 'comfortable' | 'wide'; asciiArt: AsciiArtId }
export interface Session { tabs: string[]; active: string | null; favorites: string[]; recent: string[]; positions: Record<string, number> }
export const emptySession: Session = { tabs: [], active: null, favorites: [], recent: [], positions: {} }
