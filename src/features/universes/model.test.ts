import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import type { MarkdownDocument } from '../../types'
import { connectedDocumentIds, indexReferences, parseUniverses, portableFolderKey, remarkWikiLinks, resolveReference, resolveUniverseFolder, suggestedUniverses, universeDocuments, universeFolders, wikiPrefix } from './model'
const doc = (path: string, content = ''): MarkdownDocument => ({ id: path, path, name: path.split('/').pop()!, content, modified: 0 })

describe('universe membership', () => {
  it('keeps folder universes connected when the portable directory is moved', () => {
    const original = { ...doc('C:/old/Exemplos/Estudos/nota.md'), id:'portable:Exemplos/Estudos/nota.md' }
    const moved = { ...original, path:'D:/new/Exemplos/Estudos/nota.md' }
    const universe = { id:'u', name:'Estudos', description:'', folder:'C:/old/Exemplos/Estudos', documentIds:[], portableFolder:portableFolderKey('C:/old/Exemplos/Estudos',[original]) }
    expect(universe.portableFolder).toBe('portable:Exemplos/Estudos')
    expect(universeDocuments(universe,[moved])).toEqual([moved])
    expect(resolveUniverseFolder(universe,[moved])).toBe('D:/new/Exemplos/Estudos')
    expect(parseUniverses(JSON.stringify([universe]))?.[0].portableFolder).toBe(universe.portableFolder)
  })
  it('does not absorb external folders into the portable profile or adjacent folder names', () => {
    const docs = [{ ...doc('C:/app/Exemplos/a.md'), id:'portable:Exemplos/a.md' }, { ...doc('C:/app/Exemplos2/b.md'), id:'portable:Exemplos2/b.md' }]
    expect(portableFolderKey('D:/Externo',docs)).toBeUndefined()
    expect(universeDocuments({id:'u',name:'x',description:'',folder:'old/Exemplos',portableFolder:'portable:Exemplos',documentIds:[]},docs)).toEqual([docs[0]])
  })
  it('starts suggestions at the registered root and exposes all nested folders in the picker', () => {
    const docs = [doc('//?/C:/Projeto/Docs/api/contrato.md'), doc('//?/C:/Projeto/Docs/backlog/plano.md')]
    const universes = suggestedUniverses(docs, ['C:/Projeto/Docs'])
    expect(universes.map(universe => universe.name)).toEqual(['Docs'])
    expect(universeDocuments(universes[0], docs)).toHaveLength(2)
    expect(universeFolders(docs, ['C:/Projeto/Docs'])).toEqual(['C:/Projeto/Docs', 'C:/Projeto/Docs/api', 'C:/Projeto/Docs/backlog'])
  })
  it('groups a folder and its descendants, without including a sibling with a similar name', () => {
    const docs = [doc('Projeto/a.md'), doc('Projeto/notas/b.md'), doc('Projeto2/c.md'), doc('Downloads/d.md')]
    const universe = { id: 'u', name: 'Projeto', description: '', folder: 'Projeto', documentIds: ['Downloads/d.md'] }
    expect(universeDocuments(universe, docs).map(d=>d.id)).toEqual(['Projeto/a.md','Projeto/notas/b.md','Downloads/d.md'])
  })
  it('keeps loose files separate and allows a note in more than one universe', () => {
    const docs = [doc('a.md'), doc('Pasta/b.md')]
    const universes = suggestedUniverses(docs)
    expect(universeDocuments(universes.find(u=>u.folder==='')!,docs)).toEqual([docs[0]])
    expect(universeDocuments({ id:'manual',name:'Leitura',description:'',folder:null,documentIds:docs.map(d=>d.id) },docs)).toHaveLength(2)
  })
  it('restores an intentionally empty list and rejects invalid persisted data', () => {
    expect(parseUniverses('[]')).toEqual([])
    expect(parseUniverses('bad')).toBeNull()
    expect(parseUniverses('[{"id":"u","name":"Meu espaço","folder":null,"documentIds":["a",null,"a"]}]')?.[0].documentIds).toEqual(['a'])
  })
})
describe('real Markdown references', () => {
  it('finds aliases, sections, relative and reference-style links but excludes code, HTML and images', () => {
    const a = doc('Projeto/a.md', '# Fontes\n[[b#Detalhes|Veja B]]\n[B](b.md#Detalhes)\n[Outro][b]\n\n[b]: b.md\n\n`[[falso]]`\n\n~~~md\n[[falso]]\n[falso](b.md)\n~~~\n\n![imagem](b.md)\n<!-- [[falso]] -->')
    const refs = indexReferences([a,doc('Projeto/b.md')])
    expect(refs).toHaveLength(3)
    expect(refs.every(ref=>ref.targetId==='Projeto/b.md')).toBe(true)
    expect(refs[0]).toMatchObject({ label:'Veja B',line:2,section:'Fontes',fragment:'Detalhes' })
  })
  it('resolves a sibling over duplicates elsewhere and exposes global ambiguities', () => {
    const docs = [doc('Projeto/a.md'),doc('Projeto/Plano.md'),doc('Downloads/Plano.md')]
    expect(resolveReference(docs[0],'Plano','wiki',docs).targetId).toBe('Projeto/Plano.md')
    const external=doc('Estudo/inicio.md')
    expect(resolveReference(external,'Plano','wiki',[external,...docs])).toMatchObject({status:'ambiguous',candidates:['Projeto/Plano.md','Downloads/Plano.md']})
  })
  it('preserves unknown destinations and resolves references across folders without adding files', () => {
    const docs = [doc('Projeto/a.md','[B](../Estudo/b.md) [[Ausente]] [web](https://example.com/a.md)'),doc('Estudo/b.md')]
    const refs=indexReferences(docs)
    expect(refs.map(r=>r.status)).toEqual(['resolved','missing','external'])
    expect(refs[0].targetId).toBe('Estudo/b.md')
  })
  it('decodes spaced paths and supports Windows case semantics', () => {
    const docs=[doc('C:/Notas/a.md'),doc('C:/Notas/Meu Plano.md')]
    expect(resolveReference(docs[0],'meu%20plano.md','markdown',docs).targetId).toBe(docs[1].id)
    expect(resolveReference(doc('inicio.md'),'Outra.md','markdown',[doc('Outra.md')]).targetId).toBe('Outra.md')
  })
  it('does not infer citations merely from a shared folder or a plain title mention', () => {
    expect(indexReferences([doc('Pasta/a.md','A nota b.md é interessante.'),doc('Pasta/b.md')])).toEqual([])
  })
  it('keeps escaped wikilinks as literal text and uses later real links to the same target', () => {
    const source='\\[[Plano]] e [[Plano]] e `[[Plano]]`'
    expect(indexReferences([doc('a.md',source),doc('Plano.md')])).toHaveLength(1)
    const processor=unified().use(remarkParse).use(remarkWikiLinks)
    const tree=processor.runSync(processor.parse(source),source)
    expect(JSON.stringify(tree).match(/"type":"link"/g)).toHaveLength(1)
    expect(JSON.stringify(tree)).toContain(wikiPrefix+'Plano')
  })
  it('suggests a connected set across folders, without absorbing same-folder neighbors or ambiguous targets', () => {
    const docs=[doc('A/start.md','[Outra](../B/end.md) [[Tema]]'),doc('B/end.md','[[third]]'),doc('B/third.md'),doc('A/isolated.md'),doc('C/Tema.md'),doc('D/Tema.md')]
    expect(connectedDocumentIds(docs[0].id,docs,indexReferences(docs))).toEqual(['A/start.md','B/end.md','B/third.md'])
    expect(connectedDocumentIds('missing',docs,[])).toEqual([])
  })
})
