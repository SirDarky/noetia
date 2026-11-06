# Contribuindo

Obrigado por ajudar a melhorar o Noetia.

Para relatar um problema, informe a versão do aplicativo, versão/arquitetura do Windows, passos para reproduzir e resultado esperado. Use uma nota fictícia mínima; não publique arquivos pessoais, tokens ou capturas com dados privados.

Para alterações, abra uma issue descrevendo o problema ou proposta. Preserve o uso local de Markdown, a separação dos comentários e os limites de acesso às pastas cadastradas. Não inclua perfis do WebView2, dados da biblioteca, credenciais ou artefatos de compilação no Git.

Antes do pull request:

```powershell
npm ci
npm test
npm run build
npm run test:native -- --release --locked
```

Mudanças em arquivos devem preservar rascunhos, validar conflitos e ter testes em diretórios temporários. Mudanças visuais devem ser conferidas em temas claro/escuro e na janela mínima de 760 × 560.

As contribuições de código seguem a licença MIT do projeto. Novas artes precisam ter origem e permissão de redistribuição documentadas.
