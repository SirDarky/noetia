import { isValidElement, useEffect, useId, useState, type ReactNode } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Copy, Check, ImageOff } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import type { MarkdownDocument } from '../../types'
import { assignHeadingIds, assignSourcePositions } from '../../lib/headings'
import { getTheme } from '../../lib/themes'
import { localImage, native } from '../../services/files'
import { remarkWikiLinks, wikiPrefix } from '../universes/model'
import { annotateCommentSource } from './comment-anchors'

function text(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(text).join('')
  if (children && typeof children === 'object' && 'props' in children) return text((children.props as { children?: ReactNode }).children)
  return ''
}
function Diagram({ code, theme }: { code: string; theme: string }) {
  const id = useId().replace(/:/g, '')
  const [result, setResult] = useState('')
  const [error, setError] = useState(false)
  useEffect(() => {
    let stopped = false
    setResult(''); setError(false)
    import('mermaid').then(async ({ default: mermaid }) => {
      if (stopped) return
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: getTheme(theme).mode === 'light' ? 'neutral' : 'dark', suppressErrorRendering: true })
      const { svg } = await mermaid.render(`diagram-${id}-${Date.now()}`, code)
      if (!stopped) setResult(svg)
    }).catch(() => { if (!stopped) setError(true) })
    return () => { stopped = true }
  }, [code, id, theme])
  return error ? <div className="diagram-error"><small>Não foi possível desenhar este diagrama.</small><pre>{code}</pre></div>
    : <div className="diagram" role="img" aria-label="Diagrama Mermaid">{result ? <div dangerouslySetInnerHTML={{ __html: result }} /> : <span className="muted">Desenhando diagrama…</span>}</div>
}
function LocalImage({ src, alt, path }: { src: string; alt?: string; path: string }) {
  const [url, setUrl] = useState(''), [error, setError] = useState('')
  useEffect(() => {
    let stopped = false, loaded = ''
    setError(''); setUrl('')
    // Remote images are deliberately opt-in: browsing a local document should not contact its URLs.
    if (/^https?:/i.test(src)) { setError('Imagem externa. Abra o endereço para visualizar.'); return }
    localImage(path, src).then(result => { loaded = result; if (!stopped) setUrl(result); else if (result.startsWith('blob:')) URL.revokeObjectURL(result) })
      .catch(err => { if (!stopped) setError(String(err instanceof Error ? err.message : err)) })
    return () => { stopped = true; if (loaded.startsWith('blob:')) URL.revokeObjectURL(loaded) }
  }, [src, path])
  return url ? <img src={url} alt={alt ?? ''} onError={() => { setUrl(''); setError('Imagem indisponível.') }} /> : <span className="image-placeholder"><ImageOff size={16} /><span>{alt || 'Imagem'}<small>{error || 'Carregando…'}</small></span></span>
}
function CodeBlock({ children, source, diagram = false, start, end }: { children: ReactNode; source: string; diagram?: boolean; start?: number; end?: number }) {
  const [copied, setCopied] = useState(false)
  return <div className="code-block" data-source-start={start} data-source-end={end}><button className="copy-code" title="Copiar código" aria-label="Copiar código" onClick={async () => {
    try { await navigator.clipboard.writeText(source); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { setCopied(false) }
  }}>{copied ? <Check size={14} /> : <Copy size={14} />}</button>{diagram ? children : <pre>{children}</pre>}</div>
}
export function MarkdownReader({ doc, theme, onLink, onError, highlightLine }: { doc: MarkdownDocument; theme: string; onLink: (href: string) => void; onError: (message: string) => void; highlightLine?: number }) {
  const highlighted = (node?: { position?: { start: { line: number }; end: { line: number } } }) => highlightLine !== undefined && node?.position && node.position.start.line <= highlightLine && node.position.end.line >= highlightLine ? 'reference-highlight' : undefined
  return <ReactMarkdown remarkPlugins={[remarkGfm, remarkWikiLinks]} rehypePlugins={[rehypeHighlight, assignHeadingIds, [assignSourcePositions, { highlightLine }], annotateCommentSource]} skipHtml
    urlTransform={url => defaultUrlTransform(url)}
    components={{
      a: ({ href, children }) => <a href={href} onClick={event => {
        event.preventDefault()
        if (!href) return
        if (href.startsWith(wikiPrefix)) { onLink(href); return }
        if (href.startsWith('#')) { document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); return }
        if (/^https?:\/\//i.test(href)) {
          if (native) invoke('open_external', { url: href }).catch(error => onError(String(error)))
          else window.open(href, '_blank', 'noopener,noreferrer')
        } else onLink(href)
      }}>{children}</a>,
      p: ({ children, node }) => <p className={highlighted(node)} data-source-start={node?.position?.start.line} data-source-end={node?.position?.end.line}>{children}</p>,
      li: ({ children, node, ...props }) => <li {...props} className={[props.className,highlighted(node)].filter(Boolean).join(' ')} data-source-start={node?.position?.start.line} data-source-end={node?.position?.end.line}>{children}</li>,
      img: ({ src, alt }) => <LocalImage src={typeof src === 'string' ? src : ''} alt={alt} path={doc.path} />,
      table: ({ children, node }) => <div className={`table-scroll ${highlighted(node)??''}`} data-source-start={node?.position?.start.line} data-source-end={node?.position?.end.line}><table>{children}</table></div>,
      pre: ({ children, node }) => {
        const child = Array.isArray(children) ? children[0] : children
        const props = isValidElement<{ className?: string; children?: ReactNode }>(child) ? child.props : null
        const source = text(children)
        const diagram = props?.className?.includes('language-mermaid') ?? false
        return <CodeBlock source={source} diagram={diagram} start={node?.position?.start.line} end={node?.position?.end.line}>{diagram ? <Diagram code={source} theme={theme} /> : children}</CodeBlock>
      },
      code: ({ className, children }) => <code className={className}>{children}</code>,
    }}>{doc.content}</ReactMarkdown>
}
