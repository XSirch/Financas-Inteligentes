import { z } from "zod";
import type { FinanceSnapshot, FinanceAccount, FinanceTransaction, FinanceInvestment } from "@workspace/api-zod";
import { FinanceError, saveSnapshot } from "./storage";

const origin = "https://api.pluggy.ai";
let apiKey: { value: string; until: number } | undefined;
let running: Promise<FinanceSnapshot> | undefined;
const row = z.object({ id: z.string() }).catchall(z.unknown());
type Row = z.infer<typeof row>;
const string = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? value as Record<string, unknown> : {};

export function pluggyConfigured() {
  return !!(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET && process.env.PLUGGY_ITEM_IDS);
}

async function key() {
  if (apiKey && apiKey.until > Date.now()) return apiKey.value;
  if (!pluggyConfigured()) throw new FinanceError(503, "Configure as credenciais e PLUGGY_ITEM_IDS na VPS. Não envie segredos pelo app.");
  const response = await fetch(`${origin}/auth`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: process.env.PLUGGY_CLIENT_ID, clientSecret: process.env.PLUGGY_CLIENT_SECRET }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new FinanceError(502, `A autenticação Pluggy falhou (${response.status}).`);
  const data = z.object({ apiKey: z.string().min(1) }).parse(await response.json());
  apiKey = { value: data.apiKey, until: Date.now() + 90 * 60 * 1000 };
  return apiKey.value;
}

async function get(path: string) {
  const response = await fetch(`${origin}${path}`, {
    headers: { "X-API-KEY": await key() }, signal: AbortSignal.timeout(30000),
  });
  if (response.status === 401) apiKey = undefined;
  if (!response.ok) throw new FinanceError(502, `Consulta Pluggy falhou (${response.status}). O último retrato foi preservado.`);
  return response.json() as Promise<unknown>;
}

async function pages(path: string): Promise<Row[]> {
  const results: Row[] = [];
  for (let page = 1; page <= 100; page++) {
    const data = z.object({
      results: z.array(row), totalPages: z.number().int().nonnegative(),
    }).parse(await get(`${path}&pageSize=500&page=${page}`));
    results.push(...data.results);
    if (page >= data.totalPages) return results;
  }
  throw new FinanceError(502, "Muitas páginas na Pluggy; importação cancelada sem substituir os dados anteriores.");
}

async function transactions(accountId: string): Promise<Row[]> {
  const results: Row[] = [];
  let query = `?accountId=${encodeURIComponent(accountId)}`;
  const seen = new Set<string>();
  for (let page = 0; page < 500; page++) {
    if (seen.has(query)) throw new FinanceError(502, "Cursor repetido na Pluggy.");
    seen.add(query);
    const data = z.object({
      results: z.array(row), next: z.string().nullable(),
    }).parse(await get(`/v2/transactions${query}`));
    results.push(...data.results);
    if (!data.next) return results;
    if (!data.next.startsWith("?") || data.next.includes("#")) throw new FinanceError(502, "Cursor inválido.");
    const next = new URLSearchParams(data.next.slice(1));
    if (next.get("accountId") !== accountId) throw new FinanceError(502, "Cursor pertence a outra conta.");
    query = `?${next.toString()}`;
  }
  throw new FinanceError(502, "Histórico excedeu o limite; nenhum dado parcial foi salvo.");
}

function normalizeTransaction(t: Row, account: FinanceAccount): FinanceTransaction {
  const amount = number(t.amount);
  if (amount === null || !string(t.date)) throw new FinanceError(502, "Transação sem valor ou data válida.");
  const category = string(t.category, "Sem categoria");
  const card = account.type === "CREDIT";
  // Pluggy: card purchases are CREDIT/positive, bank debits are DEBIT/negative.
  let kind: FinanceTransaction["kind"] = card
    ? (string(t.type) === "CREDIT" ? "expense" : "income")
    : (string(t.type) === "DEBIT" ? "expense" : "income");
  if (/credit card payment|pagamento de fatura/i.test(category)) kind = "card_payment";
  if (/same person transfer|transferência entre contas próprias/i.test(category)) kind = "transfer";
  const meta = object(t.creditCardMetadata);
  return {
    id: t.id, accountId: account.id,
    description: string(t.description, "Sem descrição"),
    amount: Math.abs(amount), date: string(t.date),
    category, kind, currency: string(t.currencyCode, account.currency),
    installmentNumber: number(meta.installmentNumber),
    installmentTotal: number(meta.totalInstallments),
    pending: string(t.status) !== "POSTED",
  };
}

async function performSync(): Promise<FinanceSnapshot> {
  const ids = [...new Set((process.env.PLUGGY_ITEM_IDS || "").split(",").map(id => id.trim()).filter(Boolean))];
  if (!ids.length || !pluggyConfigured()) throw new FinanceError(503, "Configure a conexão Pluggy na VPS.");
  const snapshot: FinanceSnapshot = {
    accounts: [], transactions: [], investments: [], lastSyncAt: null,
    warnings: [
      "Dados disponíveis conforme a cobertura e o consentimento de cada instituição.",
      "Transferências e estornos com categoria ambígua precisam de revisão. Créditos de estorno não são renda recorrente.",
      "Sincronização copia os dados já disponíveis na Pluggy; não força atualização bancária nem garante tempo real.",
    ],
  };
  for (const id of ids) {
    const item = z.object({
      connector: z.object({ name: z.string() }),
      status: z.string(), lastUpdatedAt: z.string().nullable().optional(),
    }).parse(await get(`/items/${encodeURIComponent(id)}`));
    if (item.status !== "UPDATED") {
      snapshot.warnings.push(`${item.connector.name}: estado da conexão ${item.status}; pode exigir nova autorização.`);
    }
    if (item.lastUpdatedAt) snapshot.warnings.push(`${item.connector.name}: banco atualizado em ${item.lastUpdatedAt}.`);
    for (const a of await pages(`/accounts?itemId=${encodeURIComponent(id)}`)) {
      if (!["BANK", "CREDIT"].includes(string(a.type))) continue;
      const balance = number(a.balance);
      if (balance === null) throw new FinanceError(502, "Conta sem saldo válido; importação não foi salva.");
      const credit = object(a.creditData);
      const account: FinanceAccount = {
        id: a.id, name: string(a.name, "Conta"), type: a.type as "BANK" | "CREDIT",
        balance, currency: string(a.currencyCode, "BRL"), institution: item.connector.name,
        creditLimit: number(credit.creditLimit), dueDate: string(credit.balanceDueDate) || null,
      };
      snapshot.accounts.push(account);
      snapshot.transactions.push(...(await transactions(a.id)).map(t => normalizeTransaction(t, account)));
    }
    // No silent zero when this product is not permitted: fail and preserve the previous complete snapshot.
    for (const i of await pages(`/investments?itemId=${encodeURIComponent(id)}`)) {
      const balance = number(i.balance);
      if (balance === null) {
        snapshot.warnings.push(`Investimento ${string(i.name, "sem nome")}: saldo ausente; não incluído nos totais.`);
        continue;
      }
      const investment: FinanceInvestment = {
        id: i.id, name: string(i.name, "Investimento"), type: string(i.type, "OTHER"),
        balance, currency: string(i.currencyCode, "BRL"),
        institution: string(object(i.institution).name, item.connector.name),
      };
      snapshot.investments.push(investment);
    }
  }
  snapshot.accounts = [...new Map(snapshot.accounts.map(a => [a.id, a])).values()];
  snapshot.transactions = [...new Map(snapshot.transactions.map(t => [t.id, t])).values()]
    .sort((a, b) => b.date.localeCompare(a.date));
  snapshot.investments = [...new Map(snapshot.investments.map(i => [i.id, i])).values()];
  snapshot.lastSyncAt = new Date().toISOString();
  await saveSnapshot(snapshot);
  return snapshot;
}

export async function syncPluggy() {
  running ??= performSync();
  try { return await running; } finally { running = undefined; }
}
