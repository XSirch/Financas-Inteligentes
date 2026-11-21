import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import {
  setBaseUrl,
  getGetFinanceSnapshotQueryKey,
  getGetFinanceStatusQueryKey,
  type FinanceSnapshot,
  type FinanceTransactionKind,
} from '@workspace/api-client-react';
import { currentMonthKey, uid } from '@/lib/format';

export type Kind = FinanceTransactionKind;

export type LocalTx = {
  id: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category: string;
  kind: Kind;
  accountId: string | null;
  note: string;
  createdAt: string;
};
export type Budget = { id: string; category: string; limit: number };
export type Contribution = { id: string; amount: number; date: string };
export type Goal = { id: string; name: string; target: number; deadline: string | null; contributions: Contribution[] };
export type Holding = { id: string; name: string; type: string; institution: string; balance: number; currency: string };
export type ManualAccount = {
  id: string;
  name: string;
  type: 'BANK' | 'CREDIT';
  institution: string;
  balance: number | null;
  currency: string;
  dueDay: number | null;
};
export type Subscription = { id: string; name: string; amount: number; billingDay: number; active: boolean; note: string };
export type ChatMsg = { id: string; role: 'user' | 'assistant' | 'error'; text: string; at: string; model?: string; withContext?: boolean };
export type Imported = { scope: string; snapshot: FinanceSnapshot; receivedAt: string };

export type Store = {
  version: 1;
  transactions: LocalTx[];
  budgets: Budget[];
  goals: Goal[];
  holdings: Holding[];
  accounts: ManualAccount[];
  subscriptions: Subscription[];
  overrides: Record<string, string>;
  chat: ChatMsg[];
  settings: { serverOrigin: string | null; hideAmounts: boolean };
  imported: Imported | null;
};

const KEY = 'auria.store.v1';

const empty = (): Store => ({
  version: 1,
  transactions: [],
  budgets: [],
  goals: [],
  holdings: [],
  accounts: [],
  subscriptions: [],
  overrides: {},
  chat: [],
  settings: { serverOrigin: null, hideAmounts: false },
  imported: null,
});

export const DEFAULT_ORIGIN = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : null;
if (DEFAULT_ORIGIN) setBaseUrl(DEFAULT_ORIGIN);

type Ctx = {
  store: Store;
  hydrated: boolean;
  loadError: string | null;
  persistError: string | null;
  origin: string | null;
  month: string;
  setMonth: (m: string) => void;
  upsertTx: (tx: Omit<LocalTx, 'id' | 'createdAt'> & { id?: string }) => Promise<void>;
  deleteTx: (id: string) => Promise<void>;
  setOverride: (importedId: string, category: string | null) => Promise<void>;
  upsertBudget: (b: Omit<Budget, 'id'> & { id?: string }) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  upsertGoal: (g: Omit<Goal, 'id' | 'contributions'> & { id?: string }) => Promise<string>;
  deleteGoal: (id: string) => Promise<void>;
  addContribution: (goalId: string, amount: number, date: string) => Promise<void>;
  removeContribution: (goalId: string, contributionId: string) => Promise<void>;
  upsertHolding: (h: Omit<Holding, 'id'> & { id?: string }) => Promise<void>;
  deleteHolding: (id: string) => Promise<void>;
  upsertAccount: (a: Omit<ManualAccount, 'id'> & { id?: string }) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  upsertSubscription: (x: Omit<Subscription, 'id'> & { id?: string }) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  appendChat: (m: Omit<ChatMsg, 'id' | 'at'>) => Promise<void>;
  clearChat: () => Promise<void>;
  setHideAmounts: (v: boolean) => Promise<void>;
  setServerOrigin: (origin: string | null) => Promise<void>;
  setImported: (scope: string, snapshot: FinanceSnapshot) => Promise<void>;
  clearImported: () => Promise<void>;
  clearLocal: () => Promise<void>;
  exportJSON: () => string;
};

const FinanceCtx = createContext<Ctx | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [store, setStore] = useState<Store>(empty);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [month, setMonth] = useState<string>(currentMonthKey());
  const storeRef = useRef<Store>(store);
  const hydratedRef = useRef(false);
  const chain = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let alive = true;
    (async () => {
      let next = empty();
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<Store>;
            next = { ...empty(), ...parsed, settings: { ...empty().settings, ...(parsed.settings ?? {}) } };
          } catch {
            await AsyncStorage.setItem(KEY + '.corrupt.' + Date.now(), raw);
            setLoadError('Os dados salvos estavam ilegíveis. Uma cópia foi preservada e o app começou vazio.');
          }
        }
      } catch {
        setLoadError('Não foi possível ler os dados deste aparelho.');
      }
      if (!alive) return;
      const origin = next.settings.serverOrigin ?? DEFAULT_ORIGIN;
      setBaseUrl(origin);
      storeRef.current = next;
      setStore(next);
      hydratedRef.current = true;
      setHydrated(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const commit = useCallback(async (fn: (s: Store) => Store) => {
    if (!hydratedRef.current) throw new Error('Os dados ainda estão carregando. Tente em instantes.');
    const next = fn(storeRef.current);
    storeRef.current = next;
    setStore(next);
    const write = chain.current.then(async () => {
      try {
        await AsyncStorage.setItem(KEY, JSON.stringify(storeRef.current));
        setPersistError(null);
      } catch {
        setPersistError('Falha ao salvar neste aparelho. Suas últimas alterações podem não persistir.');
        throw new Error('Falha ao salvar neste aparelho.');
      }
    });
    chain.current = write.catch(() => {});
    await write;
  }, []);

  const origin = store.settings.serverOrigin ?? DEFAULT_ORIGIN;

  const value = useMemo<Ctx>(() => {
    const upsert = <T extends { id: string }>(list: T[], item: T) =>
      list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];
    return {
      store,
      hydrated,
      loadError,
      persistError,
      origin,
      month,
      setMonth,
      upsertTx: (tx) =>
        commit((s) => {
          const prev = tx.id ? s.transactions.find((t) => t.id === tx.id) : undefined;
          const item: LocalTx = { ...tx, id: tx.id ?? uid(), createdAt: prev?.createdAt ?? new Date().toISOString() };
          return { ...s, transactions: upsert(s.transactions, item) };
        }),
      deleteTx: (id) => commit((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) })),
      setOverride: (importedId, category) =>
        commit((s) => {
          const o = { ...s.overrides };
          if (category) o[importedId] = category;
          else delete o[importedId];
          return { ...s, overrides: o };
        }),
      upsertBudget: (b) => commit((s) => ({ ...s, budgets: upsert(s.budgets, { ...b, id: b.id ?? uid() }) })),
      deleteBudget: (id) => commit((s) => ({ ...s, budgets: s.budgets.filter((b) => b.id !== id) })),
      upsertGoal: async (g) => {
        const id = g.id ?? uid();
        await commit((s) => {
          const prev = s.goals.find((x) => x.id === id);
          return { ...s, goals: upsert(s.goals, { ...g, id, contributions: prev?.contributions ?? [] }) };
        });
        return id;
      },
      deleteGoal: (id) => commit((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) })),
      addContribution: (goalId, amount, date) =>
        commit((s) => ({
          ...s,
          goals: s.goals.map((g) =>
            g.id === goalId ? { ...g, contributions: [{ id: uid(), amount, date }, ...g.contributions] } : g,
          ),
        })),
      removeContribution: (goalId, cid) =>
        commit((s) => ({
          ...s,
          goals: s.goals.map((g) =>
            g.id === goalId ? { ...g, contributions: g.contributions.filter((c) => c.id !== cid) } : g,
          ),
        })),
      upsertHolding: (h) => commit((s) => ({ ...s, holdings: upsert(s.holdings, { ...h, id: h.id ?? uid() }) })),
      deleteHolding: (id) => commit((s) => ({ ...s, holdings: s.holdings.filter((h) => h.id !== id) })),
      upsertAccount: (a) => commit((s) => ({ ...s, accounts: upsert(s.accounts, { ...a, id: a.id ?? uid() }) })),
      deleteAccount: (id) =>
        commit((s) => ({
          ...s,
          accounts: s.accounts.filter((a) => a.id !== id),
          transactions: s.transactions.map((t) => (t.accountId === id ? { ...t, accountId: null } : t)),
        })),
      upsertSubscription: (x) => commit((s) => ({ ...s, subscriptions: upsert(s.subscriptions, { ...x, id: x.id ?? uid() }) })),
      deleteSubscription: (id) => commit((s) => ({ ...s, subscriptions: s.subscriptions.filter((x) => x.id !== id) })),
      appendChat: (m) =>
        commit((s) => ({ ...s, chat: [...s.chat, { ...m, id: uid(), at: new Date().toISOString() }].slice(-200) })),
      clearChat: () => commit((s) => ({ ...s, chat: [] })),
      setHideAmounts: (v) => commit((s) => ({ ...s, settings: { ...s.settings, hideAmounts: v } })),
      setServerOrigin: async (o) => {
        await commit((s) => ({ ...s, imported: null, settings: { ...s.settings, serverOrigin: o } }));
        setBaseUrl(o ?? DEFAULT_ORIGIN);
        queryClient.removeQueries({ queryKey: getGetFinanceSnapshotQueryKey() });
        queryClient.removeQueries({ queryKey: getGetFinanceStatusQueryKey() });
      },
      setImported: (scope, snapshot) =>
        commit((s) => ({ ...s, imported: { scope, snapshot, receivedAt: new Date().toISOString() } })),
      clearImported: async () => {
        queryClient.removeQueries({ queryKey: getGetFinanceSnapshotQueryKey() });
        if (storeRef.current.imported) await commit((s) => ({ ...s, imported: null }));
      },
      clearLocal: () =>
        commit((s) => ({
          ...empty(),
          settings: s.settings,
          imported: s.imported,
        })),
      exportJSON: () => {
        const s = storeRef.current;
        return JSON.stringify(
          {
            app: 'Áuria',
            exportedAt: new Date().toISOString(),
            note: 'Dados manuais salvos neste aparelho. Registros importados aparecem separados e são somente leitura.',
            local: {
              transactions: s.transactions,
              budgets: s.budgets,
              goals: s.goals,
              holdings: s.holdings,
              accounts: s.accounts,
              subscriptions: s.subscriptions,
              categoryOverrides: s.overrides,
            },
            imported: s.imported ? { receivedAt: s.imported.receivedAt, snapshot: s.imported.snapshot } : null,
          },
          null,
          2,
        );
      },
    };
  }, [store, hydrated, loadError, persistError, origin, month, commit, queryClient]);

  return <FinanceCtx.Provider value={value}>{children}</FinanceCtx.Provider>;
}

export function useFinance(): Ctx {
  const c = useContext(FinanceCtx);
  if (!c) throw new Error('useFinance fora do FinanceProvider');
  return c;
}
