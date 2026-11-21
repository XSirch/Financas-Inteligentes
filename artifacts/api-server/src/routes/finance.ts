import { Router, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { AskFinanceAgentBody } from "@workspace/api-zod";
import { FinanceError, readSnapshot } from "../finance/storage";
import { inferWithSubscription, readCredentials } from "../finance/oauth";
import { pluggyConfigured, syncPluggy } from "../finance/pluggy";
import { logger } from "../lib/logger";

export const financeRouter = Router();
const safe = (action: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(action(req, res, next)).catch(error => {
    // Never log financial payloads or upstream OAuth bodies.
    const status = error instanceof FinanceError ? error.status : 500;
    req.log.warn({ status, errorType: error?.name }, "Finance request failed");
    res.status(status).json({ error: error instanceof FinanceError
      ? error.message : "Não foi possível concluir. Nenhum dado anterior foi substituído." });
  });
};
const requireOwner: RequestHandler = (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) return void res.status(401).json({ error: "Entre na sua conta para acessar a VPS." });
  const owner = process.env.OWNER_CLERK_USER_ID;
  if (!owner) return void res.status(503).json({ error: "Configure OWNER_CLERK_USER_ID na VPS com o identificador mostrado em Ajustes." });
  if (owner !== userId) return void res.status(403).json({ error: "Este serviço é exclusivo do proprietário." });
  next();
};
const lastRequest = new Map<string, number>();
function throttle(seconds: number): RequestHandler {
  return (req, res, next) => {
    const key = `${getAuth(req).userId}:${req.path}`;
    const now = Date.now();
    if (now - (lastRequest.get(key) || 0) < seconds * 1000) {
      res.setHeader("Retry-After", seconds);
      return void res.status(429).json({ error: "Aguarde alguns segundos antes de tentar novamente." });
    }
    lastRequest.set(key, now);
    next();
  };
}

financeRouter.get("/status", safe(async (_req, res) => {
  // Public setup flags only; never return sync history or financial timestamps.
  let oauthConfigured = false;
  try { await readCredentials(); oauthConfigured = true; } catch { /* not validated */ }
  res.json({
    service: "auria", ownerConfigured: !!process.env.OWNER_CLERK_USER_ID,
    pluggyConfigured: pluggyConfigured(), oauthConfigured,
    modelConfigured: !!process.env.CODEX_MODEL, lastSyncAt: null,
  });
}));
financeRouter.use(requireOwner);
financeRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store"); next();
});
financeRouter.get("/snapshot", safe(async (_req, res) => {
  res.json(await readSnapshot());
}));
financeRouter.post("/sync", throttle(30), safe(async (_req, res) => {
  res.json(await syncPluggy());
}));
financeRouter.post("/chat", throttle(5), safe(async (req, res) => {
  const parsed = AskFinanceAgentBody.safeParse(req.body);
  if (!parsed.success) throw new FinanceError(400, "Pergunta ou contexto inválido.");
  const { message, consent, context } = parsed.data;
  if (!consent) throw new FinanceError(400, "Autorize explicitamente o envio dos dados desta pergunta à OpenAI.");
  let local: unknown;
  try { local = JSON.parse(context); } catch { throw new FinanceError(400, "Contexto local deve ser JSON válido."); }
  const snapshot = await readSnapshot();
  // No identity documents, bank credentials, account numbers or tool execution.
  res.json(await inferWithSubscription(message, JSON.stringify({
    source: "Pluggy na VPS; dados locais declarados pelo usuário", snapshot,
    localUserProvidedData: local,
  })));
}));

export function startFinanceScheduler() {
  const hours = Number(process.env.PLUGGY_SYNC_INTERVAL_HOURS || 0);
  if (!Number.isFinite(hours) || hours <= 0) return;
  if (hours < 6) throw new Error("PLUGGY_SYNC_INTERVAL_HOURS deve ser pelo menos 6.");
  const timer = setInterval(() => {
    if (!process.env.OWNER_CLERK_USER_ID || !pluggyConfigured()) return;
    syncPluggy().catch(() => logger.warn("Automatic Pluggy sync failed; previous snapshot preserved"));
  }, hours * 3600000);
  timer.unref();
}
