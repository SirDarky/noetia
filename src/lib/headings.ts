import { headingId } from './documents'
interface HtmlNode { type: string; tagName?: string; value?: string; children?: HtmlNode[]; properties?: Record<string, unknown>; position?: { start: { line: number }; end: { line: number } } }
function plain(node: HtmlNode): string { return node.value ?? node.children?.map(plain).join('') ?? '' }
// IDs are assigned to the AST once, rather than mutated by React rendering/StrictMode.
export function assignHeadingIds() {
  return (tree: HtmlNode) => {
    const used = new Map<string, number>()
    function walk(node: HtmlNode) {
      if (node.type === 'element' && /^h[1-6]$/.test(node.tagName ?? '')) {
        node.properties = { ...node.properties, id: headingId(plain(node), used) }
      }
      node.children?.forEach(walk)
    }
    walk(tree)
  }
}
export function assignSourcePositions(options: { highlightLine?: number } = {}) {
  return (tree: HtmlNode) => {
    function walk(node: HtmlNode) {
      if (node.type === 'element' && /^(?:h[1-6]|blockquote|pre)$/.test(node.tagName ?? '') && node.position) {
        const { start, end } = node.position
        node.properties = { ...node.properties, 'data-source-start': start.line, 'data-source-end': end.line }
        if (options.highlightLine !== undefined && start.line <= options.highlightLine && end.line >= options.highlightLine) node.properties.className = ['reference-highlight']
      }
      node.children?.forEach(walk)
    }
    walk(tree)
  }
}
