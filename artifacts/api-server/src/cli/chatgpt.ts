/**
 * Run login on the user's computer, never expose this listener on the VPS.
 * No API key or copied ChatGPT browser session is supported.
 */
import { createServer } from "node:http";
import { randomBytes, createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { resolve, dirname } from "node:path";
import { AUTH_ORIGIN, RESOURCE, credentialsPath, exchangeCode, inferWithSubscription, listModels, readCredentials } from "../finance/oauth";
import { readPrivateJson, writePrivateJson, FinanceError } from "../finance/storage";

async function hostId() {
  const file = resolve(dirname(credentialsPath()), "host.json");
  try {
    const saved = await readPrivateJson(file) as { hostId: string };
    if (!saved.hostId?.startsWith("urn:uuid:")) throw new Error("Identificador do host inválido.");
    return saved.hostId;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const hostId = `urn:uuid:${randomUUID()}`;
    await writePrivateJson(file, { hostId });
    return hostId;
  }
}

async function login() {
  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const verifier = randomBytes(64).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const host = await hostId();
  let previous: Awaited<ReturnType<typeof readCredentials>> | undefined;
  try { previous = await readCredentials(); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new Error("Arquivo de autorização existente inválido. Preserve-o e corrija a configuração antes de autorizar novamente.");
    }
  }
  let pending = false;
  let redirectUri = "";
  await new Promise<void>((resolveLogin, rejectLogin) => {
    const server = createServer((req, res) => {
      void (async () => {
        const url = new URL(req.url || "/", "http://127.0.0.1");
        if (url.pathname !== "/auth/callback" || req.method !== "GET") {
          res.writeHead(404).end(); return;
        }
        const incomingState = Buffer.from(url.searchParams.get("state") || "");
        const expectedState = Buffer.from(state);
        if (pending || incomingState.length !== expectedState.length ||
            !timingSafeEqual(incomingState, expectedState)) {
          res.writeHead(400).end("Autorizacao invalida."); return;
        }
        pending = true;
        try {
          if (url.searchParams.has("error")) throw new FinanceError(403, "Autorização recusada na OpenAI.");
          const code = url.searchParams.get("code");
          const returnedId = url.searchParams.get("client_id");
          if (previous && returnedId && returnedId !== previous.client_id) {
            throw new FinanceError(403, "A autorização retornou outro registro de conta.");
          }
          const clientId = previous?.client_id || returnedId;
          if (!code || !clientId || clientId === "dynamic_agent_client") {
            throw new FinanceError(400, "A OpenAI não concluiu o registro do aplicativo.");
          }
          await exchangeCode({
            code, clientId, verifier, nonce, hostId: host, redirectUri,
            expectedSubject: previous?.subject,
          });
          res.writeHead(200, {
            "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store",
            "Content-Security-Policy": "default-src 'none'",
          }).end("Áuria autorizado. Pode fechar esta janela. Não compartilhe o arquivo de credenciais.");
          clearTimeout(timeout);
          server.close(); resolveLogin();
        } catch (error) {
          res.writeHead(400).end("Autorizacao nao concluida. Veja o terminal.");
          clearTimeout(timeout);
          server.close(); rejectLogin(error);
        }
      })().catch(rejectLogin);
    });
    const timeout = setTimeout(() => {
      server.close(); rejectLogin(new Error("Autorização expirou após 5 minutos."));
    }, 300000);
    server.on("error", (error) => { clearTimeout(timeout); rejectLogin(error); });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return;
      redirectUri = `http://127.0.0.1:${address.port}/auth/callback`;
      const url = new URL(`${AUTH_ORIGIN}/api/accounts/authorize`);
      const values: Record<string, string> = {
        client_id: previous?.client_id || "dynamic_agent_client",
        ext_agent_host_id: host, response_type: "code", redirect_uri: redirectUri,
        scope: "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct",
        resource: RESOURCE, state, nonce,
        code_challenge_method: "S256", code_challenge: challenge,
      };
      if (!previous) values.agent_name_hint = "Áuria";
      for (const [key, value] of Object.entries(values)) url.searchParams.set(key, value);
      process.stdout.write(`\nAbra este endereço no navegador DESTE computador:\n${url.toString()}\n\n`);
    });
  });
  process.stdout.write("Autorização salva com permissões privadas. O acesso ao modelo ainda precisa ser testado.\n");
}

async function main() {
  const command = process.argv[2];
  if (command === "login") return login();
  if (command === "host") {
    await hostId();
    process.stdout.write("Identificador exclusivo deste host criado/preservado. Não substitua host.json ao importar credenciais.\n");
    return;
  }
  if (command === "models") {
    const models = await listModels();
    process.stdout.write(JSON.stringify(models, null, 2) + "\n");
    return;
  }
  if (command === "check") {
    const result = await inferWithSubscription(
      "Responda apenas: Conexão com a assinatura validada.", "{}",
    );
    process.stdout.write(`${result.answer}\nModelo: ${result.model}\nResposta concluída: ${result.generatedAt}\n`);
    return;
  }
  throw new Error("Comando esperado: login, host, models ou check.");
}
main().catch(error => {
  // Do not print stack/objects that might contain token responses.
  process.stderr.write(`${error instanceof FinanceError ? error.message : "Não foi possível concluir. Confira configuração, rede e permissões do arquivo; nenhuma credencial foi exibida."}\n`);
  process.exitCode = 1;
});
