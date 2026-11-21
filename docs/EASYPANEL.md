# Instalar o serviço no Easypanel

Este é o caminho de instalação escolhido para a VPS Ubuntu. O Compose sobe
**somente a API privada**, não um site de finanças nem o aplicativo Android.
O app continua no celular e usa `https://chat.sirch.online` como endereço da API.

## 1. Fonte Git

O repositório precisa conter `compose.yaml`, `Dockerfile`, `.dockerignore`,
`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `ops/container-entrypoint.sh`
e os diretórios `artifacts/api-server`, `lib/api-zod` e `lib/db`.
**Copiar apenas o YAML não basta:** a imagem é construída a partir desses fontes.

No projeto do Easypanel:

1. Crie um serviço do tipo **Compose**.
2. Escolha fonte **Git**, repositório
   `https://github.com/XSirch/Financas-Inteligentes` e branch **`main`**.
3. Use **Build Path** `/`.
4. Use **Docker Compose File** `compose.yaml`.
5. Se o repositório for privado, cadastre no GitHub a chave SSH de implantação
   mostrada pelo próprio Easypanel, com acesso somente de leitura.
   Não envie essa chave nem credenciais pelo chat.

Não use o modelo de systemd nem instale Caddy/Nginx adicionalmente neste caminho.
O próprio Easypanel administra o proxy e o certificado.

## 2. Variáveis protegidas

Na seção **Environment**, use `.env.example` como lista de nomes. Ative
**Create .env file** para que o Compose consiga interpolá-las.

Antes do primeiro deploy, preencha:

- `CLERK_SECRET_KEY` e `CLERK_PUBLISHABLE_KEY`: precisam pertencer à mesma
  configuração de identidade usada pelo app. Chaves de desenvolvimento só
  servem para testes; valide a configuração de produção antes de dados reais.
- `OWNER_CLERK_USER_ID`: entre na sua conta no aplicativo e copie seu ID nos
  ajustes. Nenhum outro usuário autenticado terá acesso aos seus dados.

O Compose recusa iniciar sem essas três variáveis. Os demais campos podem ficar
vazios no primeiro deploy: a API deve indicar integrações não configuradas,
nunca inventar resultados nem usar uma API de IA paga como alternativa.

Guarde os segredos **somente no painel**. Não os coloque no YAML, Dockerfile,
argumentos de build, Git, capturas de tela ou chat. Um administrador da VPS ou
do Docker ainda pode acessar as variáveis e o volume: proteja esses acessos.

## 3. Deploy e domínio

1. Clique em **Deploy**. O Easypanel constrói a imagem; nenhum Node.js ou pnpm
   precisa ser instalado diretamente no Ubuntu.
2. Adicione o domínio `chat.sirch.online` à configuração de domínios do serviço.
3. Destino: serviço interno **`api`**, porta **`5000`**, protocolo interno **HTTP**,
   caminho público `/`, sem remover o prefixo `/api` das requisições.
4. Ative HTTPS no domínio público e a emissão do certificado no Easypanel.
5. No provedor DNS, aponte o domínio para esta VPS e confirme a resolução.

O Compose não publica portas do host, não instala outro proxy e não fixa nomes
de containers. Não adicione `ports: ["5000:5000"]` para tráfego público.
Não ative Basic Auth no proxy desta API: o aplicativo usa autenticação Bearer;
um segundo desafio HTTP impediria as chamadas normais.

Verificações no domínio, depois que o certificado estiver válido:

- `GET /api/healthz`: HTTP 200.
- `GET /api/finance/status`: flags de configuração, sem dados pessoais.
- `GET /api/finance/snapshot` sem entrar: HTTP 401.
- Outro usuário autenticado: HTTP 403.

Abrir `/` no navegador pode retornar 404: este serviço não inclui um site.
Nos ajustes do Android, informe **`https://chat.sirch.online`**, sem `/api` no final,
e confirme o destino antes de enviar seu token de login.

## 4. OAuth da assinatura ChatGPT

O Compose **não inclui uma sessão autorizada**. O login inicial deve ser feito
no computador com navegador, como descrito em [VPS.md](VPS.md).
Não publique o callback OAuth na internet e não execute `login` no terminal
remoto esperando que o navegador do celular alcance `127.0.0.1` da VPS.

A imagem inclui o comando compilado `dist/cli/chatgpt.mjs`, sem precisar de pnpm
em produção. No terminal do container `api`, crie primeiro o ID exclusivo da VPS:

```sh
node dist/cli/chatgpt.mjs host
```

Com o processo da API parado e o volume preservado, transfira o arquivo autorizado
por SSH/SFTP para **`/var/lib/auria/oauth/oauth-session.json` dentro do volume**.
O usuário da imagem é `node`, UID/GID `1000:1000`; diretórios privados precisam
de permissão `0700` e arquivos `0600`. Preserve o `host.json` gerado pela VPS.
O caminho no host do volume é administrado pelo Docker/Easypanel, não é
necessariamente `/var/lib/auria`: identifique a montagem antes de transferir.
Não cole o conteúdo do arquivo no editor do painel ou no chat.

Para comandos com a API parada, um administrador pode usar o mesmo projeto
Compose e seu arquivo de ambiente, na pasta de build gerenciada pelo Easypanel:

```sh
docker compose run --rm --no-deps api node dist/cli/chatgpt.mjs host
docker compose run --rm --no-deps api node dist/cli/chatgpt.mjs models
# Salve CODEX_MODEL no Environment a partir do catálogo real antes de "check".
docker compose run --rm --no-deps api node dist/cli/chatgpt.mjs check
```

Use os nomes de projeto/volume do serviço existente. **Não rode esses comandos
num clone separado com outro nome de projeto:** isso pode criar um volume vazio
diferente. Caso não tenha acesso à pasta gerenciada, peça a identificação do
volume antes de executar comandos avulsos.

O container de manutenção deve montar o mesmo volume, e só um processo pode
renovar a sessão por vez. Pare o uso da mesma sessão no computador. Após
`check` concluir uma resposta real, faça o deploy da API com o modelo escolhido.
Uma imagem construída ou uma flag configurada não comprovam autorização.

## 5. Pluggy e persistência

Configure no Environment `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` e os seus
`PLUGGY_ITEM_IDS` existentes. Faça novo deploy e use Sincronizar no app.
Confira os totais com seus extratos antes de ativar a cópia agendada.
Detalhes e limitações estão em [VPS.md](VPS.md).

O volume nomeado `finance-private` conserva o retrato da Pluggy, a sessão OAuth
e o ID da VPS entre recriações do container. Não renomeie o projeto, o serviço
ou o volume sem planejar a migração. Não use `docker compose down -v`.
Não exclua o serviço/volume no painel sem backup criptografado e restauração testada.

O volume **não é um backup**. Registros manuais, metas, orçamentos e conversas
continuam locais ao aparelho e precisam da exportação pelo aplicativo.

## Validação disponível

Os testes locais do código e do bundle não equivalem a executar o Docker no
Ubuntu. A construção real da imagem, a integração do domínio com o proxy do
Easypanel, a autenticação de produção e as conexões reais devem ser verificadas
no deploy. Nenhuma alteração remota na VPS é realizada só por salvar estes arquivos.

Referência: [documentação oficial de Compose do Easypanel](https://easypanel.io/docs/services/compose).
