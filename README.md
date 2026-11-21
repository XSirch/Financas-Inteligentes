# Finanças inteligentes — serviço privado

Aplicativo Android de finanças pessoais e sua API privada, preparada para
Docker Compose no Easypanel. O app é executado no celular; o serviço na VPS
não inclui um site nem uma versão web do aplicativo.

## Instalação

Leia **[docs/EASYPANEL.md](docs/EASYPANEL.md)**.

- Fonte Git: este repositório, branch `main`.
- Build Path: `/`.
- Compose: `compose.yaml`.
- Domínio no Easypanel: `chat.sirch.online`.
- Destino HTTP interno: serviço `api`, porta `5000`.
- Configure as variáveis do modelo `.env.example` diretamente no painel.

O Compose não contém credenciais nem dados bancários e não autoriza o ChatGPT
automaticamente. As integrações precisam ser configuradas e validadas com a
conta do proprietário. Não envie tokens ao GitHub.

## Limites

- Leitura de conexões Pluggy existentes, sem movimentação financeira.
- IA com assinatura ChatGPT via OAuth; sem alternativa automática por API paga.
- Uma única instância e uma única dona da renovação da sessão OAuth.
- Volume persistente para o retrato importado e a autorização; backups devem
  ser criptografados e feitos separadamente.
- Os registros manuais, metas e conversas do app permanecem no celular.

O Dockerfile empacota somente o backend e seus arquivos de build. Os fontes do
aplicativo Android ficam em `artifacts/auria` e não entram na imagem da API.
O nome visual do aplicativo continua provisório.

Consulte [docs/VPS.md](docs/VPS.md) para o fluxo de autorização e as limitações
da integração. Salvar os arquivos no GitHub não instala nem publica o serviço.

Licença: [MIT](LICENSE).
