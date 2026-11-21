import { useEffect, useMemo, useRef } from 'react';
import {
  useGetFinanceSnapshot,
  useGetFinanceStatus,
  getGetFinanceSnapshotQueryKey,
  getGetFinanceStatusQueryKey,
  type FinanceSnapshot,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthState } from '@/context/auth';
import { useFinance, type Kind, type Store } from '@/context/finance';
import { daysUntil, todayISO } from '@/lib/format';
import { categoryInfo } from '@/lib/categories';

export type LedgerTx = {
  id: string;
  source: 'local' | 'imported';
  description: string;
  amount: number;
  date: string;
  category: string;
  originalCategory: string;
  kind: Kind;
  currency: string;
  accountLabel: string | null;
  pending: boolean;
  installment: string | null;
  note: string;
  fromCredit: boolean;
};

const noRetry = (count: number, err: unknown) => {
  const st = (err as { status?: number })?.status;
  if (st && [401, 403, 404, 503].includes(st)) return false;
  return count < 1;
};

/** Remote state: public status + owner-only snapshot. */
export function useRemote() {
  const auth = useAuthState();
  const { origin, hydrated } = useFinance();
  const scope = `${origin ?? 'none'}|${auth.userId ?? 'anon'}`;
  const status = useGetFinanceStatus({
    query: {
      queryKey: getGetFinanceStatusQueryKey(),
      enabled: hydrated && !!origin,
      staleTime: 30_000,
      retry: noRetry,
    },
  });
  const snapshot = useGetFinanceSnapshot({
    query: {
      queryKey: getGetFinanceSnapshotQueryKey(),
      enabled: hydrated && !!origin && auth.signedIn,
      staleTime: 60_000,
      retry: noRetry,
    },
  });
  return { auth, origin, scope, status, snapshot };
}

/** Mounted once: keeps the persisted imported snapshot in sync with session + server. */
export function SessionGuard() {
  const { auth, scope, snapshot } = useRemote();
  const fin = useFinance();
  const qc = useQueryClient();
  const prevUser = useRef<string | null | undefined>(undefined);
  const lastWritten = useRef<number>(0);
  const finRef = useRef(fin);
  finRef.current = fin;

  useEffect(() => {
    if (!fin.hydrated || !auth.loaded) return;
    const prev = prevUser.current;
    prevUser.current = auth.userId;
    if (prev !== undefined && prev !== auth.userId) {
      qc.removeQueries({ queryKey: getGetFinanceSnapshotQueryKey() });
      void finRef.current.clearImported();
      if (prev) void finRef.current.clearChat();
      return;
    }
    const imp = finRef.current.store.imported;
    if (imp && (!auth.signedIn || imp.scope !== scope)) void finRef.current.clearImported();
  }, [fin.hydrated, auth.loaded, auth.userId, auth.signedIn, scope, qc]);

  useEffect(() => {
    if (!snapshot.data || !auth.signedIn) return;
    if (snapshot.dataUpdatedAt === lastWritten.current) return;
    lastWritten.current = snapshot.dataUpdatedAt;
    void finRef.current.setImported(scope, snapshot.data);
  }, [snapshot.data, snapshot.dataUpdatedAt, scope, auth.signedIn]);

  return null;
}

export function useImported(): FinanceSnapshot | null {
  const { store } = useFinance();
  const auth = useAuthState();
  const { origin } = useFinance();
  const scope = `${origin ?? 'none'}|${auth.userId ?? 'anon'}`;
  if (!auth.signedIn || !store.imported || store.imported.scope !== scope) return null;
  return store.imported.snapshot;
}

export function buildLedger(store: Store, imported: FinanceSnapshot | null): LedgerTx[] {
  const accName: Record<string, string> = {};
  const creditIds = new Set((imported?.accounts ?? []).filter((a) => a.type === 'CREDIT').map((a) => a.id));
  store.accounts.forEach((a) => (accName[a.id] = a.name));
  imported?.accounts.forEach((a) => (accName[a.id] = `${a.name} · ${a.institution}`));
  const local: LedgerTx[] = store.transactions.map((t) => ({
    id: t.id,
    source: 'local',
    description: t.description,
    amount: t.amount,
    date: t.date,
    category: t.category,
    originalCategory: t.category,
    kind: t.kind,
    currency: 'BRL',
    accountLabel: t.accountId ? accName[t.accountId] ?? null : null,
    pending: false,
    installment: null,
    note: t.note,
    fromCredit: false,
  }));
  const seen = new Set<string>();
  const imp: LedgerTx[] = [];
  (imported?.transactions ?? []).forEach((t) => {
    if (seen.has(t.id)) return;
    seen.add(t.id);
    imp.push({
      id: t.id,
      source: 'imported',
      description: t.description,
      amount: Math.abs(t.amount),
      date: t.date.slice(0, 10),
      category: store.overrides[t.id] ?? t.category,
      originalCategory: t.category,
      kind: t.kind,
      currency: t.currency || 'BRL',
      accountLabel: accName[t.accountId] ?? null,
      pending: !!t.pending,
      installment: t.installmentNumber && t.installmentTotal ? `${t.installmentNumber}/${t.installmentTotal}` : null,
      note: '',
      fromCredit: creditIds.has(t.accountId),
    });
  });
  return [...local, ...imp].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function useLedger() {
  const { store } = useFinance();
  const imported = useImported();
  return useMemo(() => buildLedger(store, imported), [store, imported]);
}

export type MonthSummary = {
  income: number;
  expense: number;
  balance: number;
  count: number;
  localCount: number;
  importedCount: number;
  movedOut: number;
  cardCredits: number;
  otherCurrencies: string[];
  byCategory: Record<string, number>;
};

export function summarize(ledger: LedgerTx[], month: string): MonthSummary {
  const s: MonthSummary = {
    income: 0, expense: 0, balance: 0, count: 0, localCount: 0, importedCount: 0, movedOut: 0, cardCredits: 0,
    otherCurrencies: [], byCategory: {},
  };
  const others = new Set<string>();
  ledger.forEach((t) => {
    if (!t.date.startsWith(month)) return;
    s.count++;
    if (t.source === 'local') s.localCount++;
    else s.importedCount++;
    if (t.currency !== 'BRL') {
      others.add(t.currency);
      return;
    }
    if (t.kind === 'income') {
      // Credits on a card account are usually refunds/estornos, not income.
      if (t.fromCredit) s.cardCredits += t.amount;
      else s.income += t.amount;
    }
    else if (t.kind === 'expense') {
      s.expense += t.amount;
      s.byCategory[t.category] = (s.byCategory[t.category] ?? 0) + t.amount;
    } else s.movedOut += t.amount;
  });
  s.balance = s.income - s.expense;
  s.otherCurrencies = [...others];
  return s;
}

export type Alert = { id: string; tone: 'danger' | 'warning' | 'info'; title: string; body: string; icon: 'alert-octagon' | 'alert-triangle' | 'calendar' | 'flag' };

export function computeAlerts(store: Store, imported: FinanceSnapshot | null, summary: MonthSummary, isCurrentMonth: boolean): Alert[] {
  const out: Alert[] = [];
  store.budgets.forEach((b) => {
    const spent = summary.byCategory[b.category] ?? 0;
    const label = categoryInfo(b.category).label;
    if (b.limit > 0 && spent > b.limit) {
      out.push({ id: 'b' + b.id, tone: 'danger', icon: 'alert-octagon', title: `${label} passou do orçamento`, body: `Registrado acima do limite em ${Math.round((spent / b.limit - 1) * 100)}%.` });
    } else if (b.limit > 0 && spent >= b.limit * 0.85) {
      out.push({ id: 'b' + b.id, tone: 'warning', icon: 'alert-triangle', title: `${label} perto do limite`, body: `${Math.round((spent / b.limit) * 100)}% do orçamento usado.` });
    }
  });
  if (isCurrentMonth) {
    imported?.accounts.forEach((a) => {
      if (a.type !== 'CREDIT' || !a.dueDate) return;
      const d = daysUntil(a.dueDate);
      if (d >= 0 && d <= 7) {
        out.push({ id: 'c' + a.id, tone: 'info', icon: 'calendar', title: `Vencimento de ${a.name}`, body: d === 0 ? 'Vence hoje, segundo a última importação.' : `Vence em ${d} ${d === 1 ? 'dia' : 'dias'}, segundo a última importação.` });
      }
    });
    const today = todayISO();
    store.accounts.forEach((a) => {
      if (a.type !== 'CREDIT' || !a.dueDay) return;
      const dd = Number(today.slice(8, 10));
      const diff = a.dueDay - dd;
      if (diff >= 0 && diff <= 5) {
        out.push({ id: 'm' + a.id, tone: 'info', icon: 'calendar', title: `Vencimento de ${a.name}`, body: diff === 0 ? 'Dia de vencimento que você cadastrou é hoje.' : `Dia de vencimento cadastrado em ${diff} ${diff === 1 ? 'dia' : 'dias'}.` });
      }
    });
    store.goals.forEach((g) => {
      if (!g.deadline) return;
      const saved = g.contributions.reduce((a, c) => a + c.amount, 0);
      const d = daysUntil(g.deadline);
      if (saved < g.target && d >= 0 && d <= 30) {
        out.push({ id: 'g' + g.id, tone: 'info', icon: 'flag', title: `Meta "${g.name}" se aproxima`, body: `Prazo em ${d} ${d === 1 ? 'dia' : 'dias'}.` });
      }
    });
  }
  return out;
}

export function sumByCurrency(items: { balance: number; currency: string }[]): { currency: string; total: number }[] {
  const m: Record<string, number> = {};
  items.forEach((i) => (m[i.currency || 'BRL'] = (m[i.currency || 'BRL'] ?? 0) + i.balance));
  return Object.entries(m)
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => (a.currency === 'BRL' ? -1 : b.currency === 'BRL' ? 1 : a.currency.localeCompare(b.currency)));
}
