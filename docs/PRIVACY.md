# Privacidade e armazenamento

Noetia não exige conta e não implementa telemetria nesta versão. Notas permanecem nos arquivos locais escolhidos.

| Dado | Onde fica |
|---|---|
| Conteúdo Markdown | Pasta original; Salvar escreve nesse arquivo |
| Cadastro de arquivos e fontes | `library.json` nos dados do aplicativo |
| Sessão, preferências, universos, rascunhos e comentários | Armazenamento local do WebView2 |
| Última versão anterior a uma gravação feita pelo Noetia | Subpasta `backups` nos dados do aplicativo |

Na instalação normal, o Windows fornece os diretórios de dados do usuário ao Tauri. No modo portátil, os diretórios do aplicativo e o perfil do WebView2 são redirecionados para `NoetiaData`, ao lado de `Noetia.exe`. Não há criptografia própria para esses dados: proteja a pasta e seus backups.

Links HTTP/HTTPS são abertos no navegador quando clicados. Imagens remotas não são carregadas automaticamente pelo leitor. O instalador pode acessar a Microsoft para obter o WebView2, se ele estiver ausente. Usar essas ações pode gerar tráfego de rede.

Comentários são locais, não compartilhados com outros usuários. Transportar um perfil portátil exige fechar o Noetia e copiar a pasta inteira. Notas fora dessa pasta precisam continuar acessíveis no mesmo caminho ou ser importadas novamente. Se uma nota externa mudar de caminho, comentários e favoritos ainda não têm migração automática de identidade.

A prévia web é diferente: mantém cópias no IndexedDB do navegador e não escreve nos Markdown originais.
