# Áuria — Finanças pessoais

Aplicativo Android de finanças pessoais com modo manual local e serviço privado em VPS para Pluggy e IA usando a assinatura ChatGPT via OAuth.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/auria run dev` — Expo, iniciado pelo workflow gerenciado
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Configuração e instalação privada: `docs/VPS.md`. Não são necessários dados bancários para abrir o modo manual.
- `pnpm --filter @workspace/api-server run oauth:login` — autorização no computador do proprietário
- `pnpm --filter @workspace/api-server run oauth:models` — catálogo da conta autorizada
- `pnpm --filter @workspace/api-server run oauth:check` — teste real sem dados financeiros

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Dados financeiros remotos: retrato normalizado em arquivo privado; dados manuais do app: AsyncStorage local
- O scaffold PostgreSQL/Drizzle permanece disponível, mas não foi adotado como banco financeiro
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/auria` — aplicativo Expo Android
- `artifacts/api-server/src/finance` — armazenamento privado, consultas Pluggy e assinatura ChatGPT
- `artifacts/api-server/src/routes/finance.ts` — rotas protegidas e rotina opcional
- `lib/api-spec/openapi.yaml` — contrato; regenere clientes após mudanças
- `docs/VPS.md`, `ops/` — guia e modelos de serviço/proxy, não executados automaticamente

## Architecture decisions

- Uso pessoal em VPS do proprietário, não um serviço financeiro público.
- A assinatura ChatGPT com OAuth é requisito; não substituir por API paga sem combinar.
- O código pode ser aberto; credenciais e dados financeiros nunca podem acompanhar o repositório.
- A execução de ferramentas do servidor pela IA não é necessária para interpretar finanças e não deve ser habilitada.
- Nenhuma conexão real deve ser declarada validada com base apenas na presença de configuração.

## Product

Prioridades: gastos/cartões/assinaturas, orçamento/metas/previsões e investimentos/patrimônio.
O agente organiza e alerta, mas não movimenta dinheiro. As integrações dependem de configuração e validação com a conta real.

## User preferences

Android, uso exclusivo do proprietário, hospedagem na VPS já existente e acesso pelo celular.
O computador pode ser usado na configuração OAuth inicial, mas não deve ser necessário para operação contínua.

## Gotchas

- As rotas financeiras exigem autenticação Clerk e correspondência exata a `OWNER_CLERK_USER_ID`; não vincular o primeiro visitante automaticamente.
- O token OAuth é renovável e deve ter apenas um processo responsável. Não executar checks concorrentes com o servidor em produção.
- Manter arquivos privados fora do Git, com permissões restritas e backups protegidos.
- Dados manuais locais não são um backup na VPS. Não prometer recuperação sem exportação.
- Usar `/v2/transactions` da Pluggy com cursores; o endpoint antigo está em descontinuação.
- A IA usa a rota Responses oficial com OAuth; não há automação de terminal ou acesso ao backend-api do ChatGPT.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
