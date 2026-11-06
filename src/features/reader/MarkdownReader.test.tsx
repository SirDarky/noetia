import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MarkdownReader } from './MarkdownReader'

const render = (content: string) => renderToStaticMarkup(<MarkdownReader doc={{ id:'fixture',name:'nota.md',path:'Exemplos/nota.md',content,modified:0 }} theme="dark" onLink={() => {}} onError={() => {}} />)

describe('Markdown rendering used in the release', () => {
  it('renders headings, formatted text, GFM tables and source mapping together', () => {
    const html = render('# Ideias\n\nUma **palavra** importante.\n\n| Nota | Estado |\n|---|---|\n| Plano | Lendo |')
    expect(html).toContain('id="ideias"')
    expect(html).toContain('<strong>')
    expect(html).toContain('palavra')
    expect(html).toContain('data-comment-source=')
    expect(html).toContain('<table>')
  })
  it('does not render raw HTML or retain script URL schemes from an untrusted note', () => {
    const html = render('<script>alert("x")</script>\n\n<img src=x onerror=alert(1)>\n\n[Link](javascript:alert%281%29)\n\nTexto normal.')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror=')
    expect(html).not.toContain('href="javascript:')
    expect(html).toContain('Texto normal.')
  })
})
