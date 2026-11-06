# Validação da versão 0.1.0

Validação local realizada em 5 e 6 de novembro de 2026, em Windows x64 com WebView2 instalado. É uma versão inicial para avaliação; esta revisão não equivale a certificar todas as combinações de Windows, hardware e tamanho de acervo.

## Verificações automatizadas

| Verificação | Resultado |
|---|---|
| Frontend, Vitest | 56 testes aprovados em 8 arquivos |
| Backend, Rust em release | 9 testes aprovados |
| TypeScript e build frontend | Aprovados; aviso de tamanho de chunks do Mermaid |
| Build Tauri / instalador NSIS | Compilados para Windows x64 |
| npm audit | 0 vulnerabilidades após atualização do DOMPurify |
| Dependências Rust via OSV | 480 pacotes consultados; Tokio atualizado para 1.53.3 |

Os testes cobrem busca, ordenação, raízes de pastas, caminhos Windows/UNC, referências, wikilinks, âncoras de comentários, formatação, parsing de dados persistidos, temas e composição do leitor com filtragem de HTML/URLs de script. No backend: gravação com cópia anterior, conflito externo, limite de tamanho, escopo por caminho canônico, extensões permitidas, compatibilidade de cadastro e identidade/rebase do perfil portátil.

A consulta OSV ao lockfile completo ainda aponta glib 0.18.5 (RUSTSEC-2024-0429), proc-macro-error 1.0.4 (RUSTSEC-2024-0370), zbus_names 4.3.4 (RUSTSEC-2026-0371), zvariant 5.15.0 (RUSTSEC-2026-0370) e zvariant_derive 5.15.0 (RUSTSEC-2026-0372). Esses cinco pacotes não aparecem na árvore compilada para x86_64-pc-windows-msvc, conferida com cargo tree. Os alertas de outros alvos não estão resolvidos para uma futura distribuição Linux. Auditorias consultam bases de avisos conhecidos e não provam ausência de falhas.

## Verificações no aplicativo nativo

| Fluxo | Evidência / resultado |
|---|---|
| Perfil portátil isolado | NoetiaData e perfil EBWebView criados ao lado do executável |
| Adicionar pasta pelo seletor do Windows | 8 documentos fictícios importados; raiz Exemplos preservada com subpastas |
| Transporte do perfil portátil | Perfil copiado com app fechado para o ZIP extraído; 8 caminhos rebaseados, sem referências ao destino anterior; abas, favorito, marcador de comentário e universo Estudos com 2 notas recuperados |
| Restaurar biblioteca ao reabrir | 8 documentos recuperados |
| Busca por conteúdo | Resultados incluem referências ao termo dentro das notas |
| Scroll da home | Rolagem restrita à lista; cabeçalho e rodapé permanecem visíveis |
| Markdown com tabela | Renderização e navegação pelo índice conferidas |
| Comentário em palavra | Seleção, marcador e conversa criados no texto |
| Resposta a comentário | Resposta salva e exibida na conversa |
| Resolver/reabrir comentário | Mudança de estado e retorno do marcador conferidos |
| Persistência da conversa | Comentário e resposta recuperados após reabrir o aplicativo |
| Temas | Troca Noite/Aurora e leitor em tema claro conferidos |
| Mermaid | Fluxograma renderizado no leitor nativo |
| Imagem local | PNG relativo carregado no desktop |
| Universo por subpasta | Universo Estudos criado com as 2 notas da pasta; pontes externas e tabela conferidas |
| Mini universo no caminho | Pasta Estudos mostrou as duas notas e permitiu abri-las |
| Favorito | Estrela e indicador na árvore atualizados |
| Arquivo grande | Aproximadamente 4,9 MB aberto, editado e salvo no Markdown original; cópia anterior conferida |
| Falha de quota de rascunho | Aviso de rascunho só na sessão reproduzido |
| Fechamento normal | ZIP final encerrou pelo botão Fechar sem rascunho pendente |
| Fechamento com rascunho volátil | Fechamento bloqueado inclusive após voltar à biblioteca; texto recuperável na sessão |
| Instalador silencioso em diretório de teste | Retorno 0; executável e desinstalador criados, sem substituir instalação anterior |
| Desinstalar instalação de teste | Retorno 0; executável de teste removido sem solicitar exclusão dos dados |
| ZIP portátil | Conteúdo inspecionado; sem NoetiaData, credenciais ou notas pessoais; hashes conferidos |

## Correções encontradas nesta revisão

- Preservação de posições de texto ao processar wikilinks, necessária aos comentários.
- Normalização dos prefixos de caminhos Windows em links relativos e imagens.
- Universos respeitam a pasta cadastrada e mantêm uma chave de pasta portátil.
- Proteção de rascunhos em memória no fechamento nativo, inclusive fora da nota.
- Permissão de encerramento da janela após a verificação dos rascunhos.
- Cartões de comentário recalculam a posição ao mudar de tamanho e ao redimensionar a janela.
- Empacotamento calcula SHA-256 também em instalações do PowerShell sem Get-FileHash disponível.

## Limites e validações externas pendentes

Não foram certificados: máquina Windows limpa sem WebView2, Windows 10 e 11 em instalações separadas, múltiplos monitores/DPI, leitor de tela, acervos muito grandes, falha de energia, travamento do processo, antivírus de terceiros, Linux/macOS ou atualização automática. O fluxo de arrastar arquivos de outro aplicativo não foi validado nesta revisão.

Os executáveis ainda não têm assinatura digital. Não há teste de reputação SmartScreen nem garantia de aceitação por políticas corporativas. A obtenção do WebView2 quando ausente pode depender de internet.

Rascunhos em memória não sobrevivem a encerramento forçado ou falta de energia. Notas externas à pasta portátil continuam dependendo de seus caminhos; o aplicativo não embute nem transporta automaticamente todo o acervo do usuário.
