import type { MarkdownDocument } from './types'

export const sample: MarkdownDocument = {
  id: 'sample:welcome', name: 'Bem-vindo ao Noetia.md', path: 'Exemplos/Bem-vindo ao Noetia.md', modified: 0,
  content: `# Um lugar para suas ideias

Bem-vindo ao **Noetia**. Abra um Markdown, encontre aquele trecho importante e continue de onde parou. Seus documentos continuam nas suas pastas.

> Leia com calma. As melhores ideias costumam aparecer entre uma linha e outra.

## Comece por aqui

1. Use **Abrir arquivo** para escolher um ou mais documentos.
2. Use **Adicionar pasta** para reunir os Markdown de um projeto.
3. Alterne entre as abas e marque seus favoritos com a estrela.
4. Busque pelo nome **ou pelo conteúdo** na biblioteca.

## Uma leitura mais confortável

O índice ao lado ajuda a explorar documentos longos. Você pode ajustar o tema, ampliar a área de leitura e esconder a biblioteca para dar mais espaço ao texto.

### Atalhos à mão

| Ação | Atalho |
| :--- | :--- |
| Abrir arquivo | Ctrl + O |
| Adicionar pasta | Ctrl + Shift + O |
| Buscar na biblioteca | Ctrl + K |
| Fechar aba atual | Ctrl + W |

## Código também tem seu lugar

\`\`\`typescript
const ideia = {
  titulo: 'Uma nova perspectiva',
  estado: 'em construção',
}

console.log(ideia.titulo)
\`\`\`

## Transforme conexões em diagramas

\`\`\`mermaid
flowchart LR
  A[Ler] --> B[Conectar ideias]
  B --> C[Descobrir]
  C --> A
\`\`\`

## Escreva e comente

A barra flutuante da nota reúne edição de Markdown, prévia, formatação e comentários. Abra um arquivo seu para editar e salve com Ctrl + S. Selecione um trecho e use o balão para registrar uma observação. Os comentários ficam separados do arquivo.


- [x] Home com a bruxinha em ASCII animado
- [x] Leitor de Markdown e tabelas
- [x] Abas, favoritos e recentes
- [x] Edição de Markdown com prévia e salvamento
- [x] Comentários sobre notas e trechos

## Feito para continuar

No desktop, o leitor acompanha o arquivo salvo no disco. Na prévia web, os arquivos importados são cópias locais deste navegador. Para atualizar uma cópia, importe o arquivo novamente.

**Noetia — leia, anote, descubra.**
`,
}
