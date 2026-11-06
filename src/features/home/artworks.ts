export const artworks = [
  { id: 'witch', name: 'Bruxinha', src: '/assets/witch.png', eyebrow: 'ENTRE AS LINHAS', caption: 'Há sempre outra\nforma de olhar.', study: '01' },
  { id: 'witch-reading', name: 'Bruxinha lendo', src: '/assets/witch-reading.png', eyebrow: 'UMA PÁGINA DE CADA VEZ', caption: 'Histórias abrem\nnovos caminhos.', study: '05' },
  { id: 'witch-portrait', name: 'Retrato da bruxinha', src: '/assets/witch-portrait.png', eyebrow: 'OUTRA PERSPECTIVA', caption: 'Uma ideia leva\nà próxima.', study: '06' },
  { id: 'moon', name: 'Lua', src: '/assets/ascii/moon.svg', eyebrow: 'DEPOIS DA MEIA-NOITE', caption: 'Uma pausa.\nUm novo horizonte.', study: '02' },
  { id: 'orbit', name: 'Órbita', src: '/assets/ascii/orbit.svg', eyebrow: 'IDEIAS EM ÓRBITA', caption: 'Tudo encontra\numa conexão.', study: '03' },
  { id: 'book', name: 'Livro astral', src: '/assets/ascii/book.svg', eyebrow: 'PÁGINAS ABERTAS', caption: 'Um universo\nem cada página.', study: '04' },
] as const

export type AsciiArtId = typeof artworks[number]['id']
export function getArtwork(id: string) { return artworks.find(art => art.id === id) ?? artworks[0] }
