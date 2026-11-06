type Palette = {
  background: string; foreground: string; card: string; popover: string; primary: string;
  primaryForeground: string; muted: string; mutedForeground: string; accent: string;
  border: string; subtle: string; reading: string; ink: string;
}

function defineTheme<T extends string>(id: T, name: string, description: string, mode: 'dark' | 'light', palette: Palette) {
  return {
    id, name, description, mode, palette,
    tokens: {
      background: palette.background, foreground: palette.foreground, card: palette.card,
      popover: palette.popover, 'popover-foreground': palette.foreground,
      primary: palette.primary, 'primary-foreground': palette.primaryForeground,
      secondary: palette.muted, 'secondary-foreground': palette.foreground,
      muted: palette.muted, 'muted-foreground': palette.mutedForeground,
      accent: palette.accent, 'accent-foreground': palette.foreground,
      destructive: mode === 'light' ? '#b43d55' : '#e77b87', border: palette.border,
      input: palette.border, ring: palette.primary, 'surface-raised': palette.card,
      subtle: palette.subtle, reading: palette.reading,
      'code-background': palette.card, 'code-foreground': palette.reading,
    },
  }
}

export const themes = [
  defineTheme('dark', 'Noite', 'Violeta e carvão', 'dark', {
    background: '#0b0b10', foreground: '#edeaf4', card: '#111117', popover: '#17171e',
    primary: '#9a86fc', primaryForeground: '#141020', muted: '#1a1a23', mutedForeground: '#a09aaf',
    accent: '#24202f', border: '#302c3c', subtle: '#8b839c', reading: '#d4d1de',
    ink: '195,188,215',
  }),
  defineTheme('light', 'Aurora', 'Lavanda e papel', 'light', {
    background: '#f6f4fa', foreground: '#242031', card: '#ffffff', popover: '#ffffff',
    primary: '#7454d5', primaryForeground: '#ffffff', muted: '#eeebf5', mutedForeground: '#696279',
    accent: '#e9e2f8', border: '#dcd6e6', subtle: '#7b728c', reading: '#423b50',
    ink: '42,34,58',
  }),
  defineTheme('sepia', 'Pergaminho', 'Papel quente e âmbar', 'light', {
    background: '#f4ecdc', foreground: '#342b22', card: '#fbf6ea', popover: '#fffaf0',
    primary: '#93602e', primaryForeground: '#ffffff', muted: '#eae0ce', mutedForeground: '#74634d',
    accent: '#e8d6b9', border: '#d9c9af', subtle: '#827057', reading: '#514334',
    ink: '65,46,26',
  }),
  defineTheme('forest', 'Bosque', 'Verde profundo e sálvia', 'dark', {
    background: '#101915', foreground: '#e5eee7', card: '#16211b', popover: '#1b2921',
    primary: '#9ccaac', primaryForeground: '#13241a', muted: '#223029', mutedForeground: '#a1b3a6',
    accent: '#2b4032', border: '#34483b', subtle: '#829a89', reading: '#cddbcf',
    ink: '188,218,196',
  }),
  defineTheme('midnight', 'Meia-noite', 'Azul profundo e gelo', 'dark', {
    background: '#0d1524', foreground: '#e6edf8', card: '#131e31', popover: '#1a2940',
    primary: '#91baf3', primaryForeground: '#10213b', muted: '#1d2d44', mutedForeground: '#a1b3ce',
    accent: '#263c5c', border: '#304764', subtle: '#8098b8', reading: '#ccd9ed',
    ink: '184,205,235',
  }),
  defineTheme('rose', 'Rosé', 'Rosa suave e vinho', 'light', {
    background: '#faf0f1', foreground: '#39272d', card: '#fff9fa', popover: '#fffafb',
    primary: '#a04e69', primaryForeground: '#ffffff', muted: '#f0e1e5', mutedForeground: '#7c616b',
    accent: '#efd5df', border: '#e2c9d1', subtle: '#8b6b77', reading: '#573d47',
    ink: '67,38,49',
  }),
] as const

export type ThemeId = typeof themes[number]['id']
export function getTheme(id: string) { return themes.find(theme => theme.id === id) ?? themes[0] }

export function applyTheme(id: string) {
  const theme = getTheme(id), root = document.documentElement
  root.dataset.theme = theme.id
  root.dataset.colorScheme = theme.mode
  for (const [name, value] of Object.entries(theme.tokens)) root.style.setProperty(`--${name}`, value)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.palette.background)
}
