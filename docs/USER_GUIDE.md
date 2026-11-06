# Guia de uso

## Biblioteca

Use **Adicionar pasta** para cadastrar Markdown e subpastas. A raiz aparece na lateral; clicar numa pasta limita os resultados àquele espaço. **Abrir arquivo** abre uma nota individual. Os arquivos não são movidos.

A busca em Seus documentos consulta nome, caminho e conteúdo. Combine-a com Todos/Favoritos/Recentes e ordenação. Recentes contém as últimas 12 notas abertas; Atualizados usa a data do arquivo, que é um critério diferente.

## Escrita e gravação

O lápis na barra inferior abre o texto-fonte. Use negrito, itálico e lista ou alterne a prévia. **Ctrl + S** salva no Markdown original no desktop. O rascunho guardado pelo aplicativo ainda não equivale a salvar no disco. Se o armazenamento local estiver cheio, aparece “Rascunho só nesta sessão”: salve a nota antes de encerrar. O aplicativo bloqueia o fechamento enquanto existir esse rascunho volátil; desligamentos ou encerramento forçado ainda podem perdê-lo.

Se o arquivo mudar fora do Noetia, compare a versão atual antes de confirmar a reconciliação. Não há mesclagem automática. Existe uma cópia da última versão anterior em `backups`, mas ainda não há tela de restauração nem histórico completo.

## Comentários no texto

Selecione uma palavra/trecho e clique em **Comentar** ou use **Ctrl + Alt + M**. No editor, **Comentar linha** usa a linha do cursor. Um marcador numerado abre a conversa, com respostas e resolver/reabrir. **Ctrl + Enter** publica no cartão; Escape o fecha.

Comentários ficam separados do Markdown. Ao mudar o trecho ou seu contexto, a aplicação pode sinalizar a citação como alterada/ambígua. Comentários antigos permanecem acessíveis. Edição, exclusão, exportação e reassociação manual ainda não estão disponíveis.

## Universos

Abra **Universos** para reunir uma pasta ou selecionar notas. Wikilinks como `[[Plano]]` e links Markdown relativos geram referências reais. Nomes ambíguos e destinos ausentes são sinalizados. O mapa tem limite de posições; use a busca ou a tabela para explorar o conjunto completo.

No caminho acima da nota, clicar numa pasta abre um mini universo para navegar pelas notas cadastradas nela.

## Aparência

A paleta do cabeçalho troca o tema. Preferências controla arte ASCII, movimento e largura de leitura. O mouse não afeta o ASCII. A animação respeita movimento reduzido e pausa quando a página fica oculta.

## Portátil

Extraia todo o ZIP numa pasta gravável e abra `Noetia.exe`. Mantenha `noetia.portable`: ele ativa o perfil em `NoetiaData`. Feche o aplicativo antes de copiar ou mover sua pasta. O modo instalado e o portátil têm perfis separados.

O perfil e notas dentro da pasta portátil podem acompanhar a mudança de pasta; notas externas continuam dependendo de seus caminhos. O ZIP contém um acervo fictício em `Exemplos` para experimentar. O Windows precisa ter o [WebView2 Runtime da Microsoft](https://developer.microsoft.com/microsoft-edge/webview2/).

## Atalhos

| Atalho | Ação |
|---|---|
| Ctrl + O | Abrir arquivo |
| Ctrl + Shift + O | Adicionar pasta |
| Ctrl + K | Focar a busca da biblioteca |
| Ctrl + S | Salvar a nota |
| Ctrl + W | Fechar aba |
| Ctrl + Alt + M | Comentar seleção/linha |
| Ctrl + Enter | Publicar comentário/resposta no cartão |

