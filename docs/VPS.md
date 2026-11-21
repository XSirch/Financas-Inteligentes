# Áuria na sua VPS

**Instalação escolhida: Easypanel no Ubuntu.** Use primeiro
[o guia de Docker Compose](EASYPANEL.md). Os modelos de systemd/Caddy abaixo
são alternativas para Linux sem Easypanel; não os instale por cima do proxy do painel.

## Estado real desta primeira versão

O aplicativo Android tem um modo manual local e uma conexão com o serviço privado.
Dados manuais, metas, orçamentos e conversas ficam no aparelho; não há backup remoto
automático desses registros nesta versão. Exporte-os antes de desinstalar ou apagar.
O servidor persiste o último retrato completo importado da Pluggy.

As integrações reais dependem da configuração abaixo. Uma flag “configurado” não
significa autenticação testada, consentimento ativo ou modelo disponível.
Nenhuma credencial bancária, sessão ChatGPT ou dinheiro de demonstração acompanha o projeto.
Nenhuma instalação ou operação foi realizada na sua VPS.

## Arquitetura e limites

App Expo Android → HTTPS → API Express privada na VPS → Pluggy / OpenAI com OAuth.

- Autenticação do app: Clerk. Autorização: somente `OWNER_CLERK_USER_ID`.
  Mesmo uma conta válida não ganha acesso sem corresponder ao proprietário.
- ChatGPT OAuth é separado do login do app. Não usa chave de API nem cobrança
  de API como alternativa silenciosa.
- O adaptador de IA usa o transporte oficial Responses com o token OAuth do plano
  ChatGPT e o modelo selecionado no catálogo da conta. Não inicia um Codex com
  acesso ao terminal, arquivos ou ferramentas. Não há execução de shell nem MCP
  financeiro pelo modelo.
- Apenas consultas e interpretação. Nenhum endpoint de pagamento, transferência,
  compra, venda ou iniciação de transação financeira.
- Token e retrato financeiro em arquivos com permissão 0600 e gravação por renomeação.
  O servidor é de processo único; não execute várias instâncias compartilhando a
  mesma sessão OAuth, pois a renovação pode rotacionar o refresh token.
- Proteja disco e backups da VPS com criptografia. A permissão do arquivo não
  substitui criptografia de disco nem protege contra comprometimento do usuário do serviço.

## Pré-requisitos

Linux com Node.js compatível com o projeto, pnpm 10.26.1, HTTPS e processo supervisionado.
Não há dependência de Docker. Os modelos de systemd e Caddy são exemplos para Linux;
confirme a distribuição e os caminhos antes de usá-los.

Na cópia privada do projeto:

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server run build
```

Variáveis do SERVIDOR, mantidas fora do repositório:

| Nome | Uso |
| --- | --- |
| `PORT` | Porta interna, por exemplo 5000; não a exponha publicamente |
| `NODE_ENV` | `production` |
| `CLERK_SECRET_KEY` | Credencial privada do mesmo provedor de identidade configurado no app |
| `CLERK_PUBLISHABLE_KEY` | Identificador público correspondente, obtido pela configuração de autenticação |
| `OWNER_CLERK_USER_ID` | Identificador da SUA conta, mostrado nos ajustes após entrar |
| `FINANCE_DATA_DIR` | Diretório privado persistente, por exemplo `/var/lib/auria/data` |
| `CODEX_OAUTH_FILE` | Arquivo protegido da sessão, por exemplo `/var/lib/auria/oauth/oauth-session.json` |
| `CODEX_MODEL` | Slug escolhido a partir do catálogo da sua conta |
| `PLUGGY_CLIENT_ID` | Credencial da aplicação Pluggy |
| `PLUGGY_CLIENT_SECRET` | Credencial privada da aplicação Pluggy |
| `PLUGGY_ITEM_IDS` | IDs das SUAS conexões existentes na mesma aplicação Pluggy, separados por vírgula |
| `PLUGGY_SYNC_INTERVAL_HOURS` | Opcional, intervalo mínimo 6 horas; omitir desativa a rotina |
| `CORS_ORIGINS` | Origens HTTPS exatas de clientes web autorizados, separadas por vírgula; o Android nativo não precisa |

Não cole esses valores no chat ou no Git. Configure-os diretamente na VPS por canal
seguro. A chave secreta Clerk precisa corresponder ao identificador público incorporado
no app. Configurações de desenvolvimento não equivalem à autenticação de produção;
confirme a configuração do domínio final antes de usar dados reais.

## Primeiro: validar a assinatura ChatGPT

Este fluxo implementa as instruções oficiais para clientes de código aberto e
servidores próprios. O acesso depende da conta e das regras atuais do provedor.
Não faz engenharia reversa de sessão do navegador.

### No seu computador, com navegador

Use uma cópia local do projeto. Defina `CODEX_OAUTH_FILE` para um caminho privado
fora do repositório, numa pasta exclusiva do Áuria. Por exemplo, em Linux/macOS:

```sh
export CODEX_OAUTH_FILE="$HOME/.config/auria/oauth-session.json"
pnpm --filter @workspace/api-server run oauth:login
```

O comando mostra um endereço de autorização sem tokens. Abra-o NO MESMO computador
e autorize a conta ChatGPT pretendida. O listener escuta apenas `127.0.0.1`, numa porta
local temporária, por até cinco minutos. O comando valida state, PKCE, nonce,
assinatura do ID token, emissor, audiência e permissão do plano antes de salvar.
Uma falha não substitui a sessão anterior.

Em seguida:

```sh
pnpm --filter @workspace/api-server run oauth:models
# Escolha um slug retornado pelo catálogo da conta.
export CODEX_MODEL="<slug-escolhido>"
pnpm --filter @workspace/api-server run oauth:check
```

`<slug-escolhido>` é um marcador, não um nome real de modelo.
O teste só tem sucesso após `response.completed` com saída de texto não vazia.
Ele não envia dados financeiros.

### Transferência para a VPS

1. Antes de importar a sessão, crie o host exclusivo da VPS com `oauth:host`,
   usando o `CODEX_OAUTH_FILE` definitivo do servidor. Esse comando cria/preserva
   `host.json` no diretório correspondente.
2. Transfira SOMENTE `oauth-session.json` por SSH/SFTP, nunca por chat, URL pública
   ou repositório. Não substitua o `host.json` da VPS pelo arquivo do computador.
3. Defina proprietário e permissões do arquivo para o usuário do serviço,
   com acesso 0600 e diretório 0700.
4. Pare o uso da sessão no computador. A VPS passa a ser dona das renovações.
5. Com o serviço ainda parado, execute `oauth:models` e `oauth:check` na VPS.
   Só depois inicie o processo contínuo.

Se o teste falhar, mantenha o chat desconectado e investigue a mensagem de erro.
Não troque por API paga. Não declare o motor validado antes de uma resposta real.
Tokens vencidos, revogados ou sem permissão exigem reautorização.

Para revogar acesso, desconecte o Áuria nas configurações do ChatGPT e pare o
serviço antes de remover o arquivo da VPS. A exclusão local isolada não revoga
a sessão remota.

Documentação oficial:
- https://developers.openai.com/siwc/token-sharing-open-source
- https://developers.openai.com/siwc/token-sharing-open-source/sign-in
- https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations

## Depois: Pluggy

Nesta versão, a integração consulta conexões JÁ CRIADAS na aplicação Pluggy do
proprietário. Configure seus IDs no servidor; não há formulário de senha bancária
no Áuria e ainda não existe um widget para criar novas conexões.

Importar usa `/accounts`, `/v2/transactions` com paginação por cursor e
`/investments`. Não usa o endpoint antigo de transações prestes a ser removido.
O servidor salva somente campos normalizados, sem CPF, número de conta,
credenciais, dados de contraparte ou respostas brutas.

- Uma importação completa substitui o retrato anterior por IDs, sem duplicar.
- Erros de rede, dados inválidos ou produto sem permissão não substituem o
  retrato completo anterior por um retrato parcial.
- O botão Sincronizar copia o que a Pluggy já conhece; não dispara atualização
  bancária, autenticação MFA nem renovação de consentimento.
- A rotina opcional faz a mesma cópia, sem depender de o celular estar aberto.
- Data da cópia e avisos sobre atualização da instituição são distintos.
- Categorias e identificação de transferências são falíveis: revise as
  classificações. O app permite correções locais, não altera o registro bancário.
- Moedas não são convertidas automaticamente; limites não equivalem a saldo.
- Saldo bancário pode já incluir aplicações automáticas. Não some saldos e
  investimentos indiscriminadamente sem revisar essa possível sobreposição.

## Acesso pelo Android

Nos ajustes do app, informe a origem HTTPS da VPS e confirme o destino antes
de autorizar chamadas autenticadas. Entre na conta e configure o identificador
mostrado como `OWNER_CLERK_USER_ID` no servidor. Reinicie o serviço após mudar
variáveis. Dados importados não devem atravessar trocas de conta ou de servidor.

O endereço da VPS não precisa ser conhecido para usar o modo manual local.
Ele precisa ser real e ter certificado válido para testar as integrações.

## Operação e proteção

Modelos de serviço e proxy: `ops/auria.service.example` e `ops/Caddyfile.example`.
O proxy é o único ponto público. Bloqueie a porta interna no firewall.
Não exponha o listener OAuth nem arquivos privados por rotas estáticas.

Verificações após instalar:

- `/api/healthz`: serviço no ar.
- `/api/finance/status`: apenas flags de configuração, sem contas ou segredos.
- `/api/finance/snapshot` sem autenticação: 401.
- Usuário autenticado diferente do proprietário: 403.
- Proprietário não definido: 503, nunca vinculação automática ao primeiro visitante.
- Sincronização real: conferir os totais com os extratos antes de confiar nas análises.

Faça backups criptografados do diretório de dados e teste restauração. Preserve
a mesma sessão OAuth em um único processo; uma cópia de backup não deve ser
executada simultaneamente à sessão ativa. Histórico e metas locais precisam
da exportação do próprio app.

## O que ainda não está incluído

Notificações push com app fechado, onboarding bancário com widget, backup
bidirecional do modo manual, identificação garantida de todas as assinaturas,
projeção completa de faturas futuras e publicação/instalação definitiva Android.
Não há promessa de rentabilidade, aconselhamento de investimento individualizado
ou garantia de que uma estimativa de gasto será segura.
