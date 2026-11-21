import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useFinance } from '@/context/finance';
import { summarize, useLedger } from '@/lib/ledger';
import { categoryInfo } from '@/lib/categories';
import { daysUntil, isoToBR, monthLabel } from '@/lib/format';
import {
  Badge, Button, Card, EmptyState, F, FadeIn, Money, MonthNav, PressableScale, ProgressBar,
  ScreenHeader, Segmented, useTabBottomPad,
} from '@/components/ui';

export default function Planning() {
  const c = useColors();
  const fin = useFinance();
  const ledger = useLedger();
  const bottom = useTabBottomPad();
  const [tab, setTab] = useState<'budgets' | 'goals'>('budgets');
  const summary = useMemo(() => summarize(ledger, fin.month), [ledger, fin.month]);

  const budgets = useMemo(
    () =>
      fin.store.budgets
        .map((b) => ({ ...b, spent: summary.byCategory[b.category] ?? 0 }))
        .sort((a, b) => b.spent / (b.limit || 1) - a.spent / (a.limit || 1)),
    [fin.store.budgets, summary],
  );
  const totalLimit = budgets.reduce((a, b) => a + b.limit, 0);
  const totalSpent = budgets.reduce((a, b) => a + b.spent, 0);
  const unbudgeted = Object.entries(summary.byCategory).filter(([cat]) => !fin.store.budgets.some((b) => b.category === cat));

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottom }} showsVerticalScrollIndicator={false}>
        <ScreenHeader eyebrow="Plano" title="Para onde vai" />
        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <Segmented
            options={[{ value: 'budgets', label: 'Orçamentos' }, { value: 'goals', label: 'Metas' }]}
            value={tab}
            onChange={setTab}
          />

          {tab === 'budgets' ? (
            <>
              <MonthNav />
              {budgets.length === 0 ? (
                <EmptyState
                  icon="pie-chart"
                  title="Nenhum limite definido"
                  body="Escolha uma categoria e um teto mensal. O progresso é calculado só com os gastos registrados em reais."
                  actionLabel="Criar orçamento"
                  onAction={() => router.push('/budget')}
                />
              ) : (
                <>
                  <Card tone="lagoon">
                    <Text style={[st.kicker, { color: c.primary }]}>Planejado para {monthLabel(fin.month)}</Text>
                    <View style={st.rowBetween}>
                      <Money value={totalSpent} style={[st.big, { color: c.foreground }]} />
                      <Text style={[st.of, { color: c.mutedForeground }]}>de </Text>
                      <Money value={totalLimit} style={[st.of, { color: c.mutedForeground }]} />
                    </View>
                    <View style={{ marginTop: 12 }}>
                      <ProgressBar ratio={totalLimit ? totalSpent / totalLimit : 0} tone={totalSpent > totalLimit ? 'danger' : 'primary'} />
                    </View>
                  </Card>
                  {budgets.map((b, i) => {
                    const cat = categoryInfo(b.category);
                    const r = b.limit ? b.spent / b.limit : 0;
                    const over = b.spent > b.limit;
                    return (
                      <FadeIn key={b.id} delay={i * 40}>
                        <PressableScale testID={`budget-${b.id}`} onPress={() => router.push({ pathname: '/budget', params: { id: b.id } })} style={[st.item, { backgroundColor: c.card, borderColor: over ? c.destructive : c.border }]}>
                          <View style={st.itemHead}>
                            <View style={[st.icon, { backgroundColor: over ? c.expenseSoft : c.auraSoft }]}>
                              <Feather name={cat.icon} size={16} color={over ? c.destructive : c.accentForeground} />
                            </View>
                            <Text style={[st.itemTitle, { color: c.foreground }]} numberOfLines={1}>{cat.label}</Text>
                            {over ? <Badge label="Acima do limite" tone="danger" /> : r >= 0.85 ? <Badge label="Perto do limite" tone="warning" /> : null}
                          </View>
                          <View style={{ marginVertical: 10 }}>
                            <ProgressBar ratio={r} tone={over ? 'danger' : r >= 0.85 ? 'warning' : 'aura'} />
                          </View>
                          <View style={st.rowBetween}>
                            <Money value={b.spent} style={[st.small, { color: c.foreground }]} />
                            <Text style={[st.small, { color: c.mutedForeground, fontFamily: F.regular }]}>
                              {over ? 'excedeu ' : 'restam '}
                            </Text>
                            <Money value={Math.abs(b.limit - b.spent)} style={[st.small, { color: over ? c.destructive : c.mutedForeground, flex: 1, textAlign: 'right' }]} />
                          </View>
                        </PressableScale>
                      </FadeIn>
                    );
                  })}
                  <Button label="Novo orçamento" icon="plus" variant="secondary" onPress={() => router.push('/budget')} />
                </>
              )}
              {unbudgeted.length > 0 ? (
                <Card>
                  <Text style={[st.kicker, { color: c.mutedForeground }]}>Gastos sem orçamento neste mês</Text>
                  {unbudgeted.map(([cat, v]) => (
                    <PressableScale key={cat} onPress={() => router.push({ pathname: '/budget', params: { category: cat } })} style={st.unRow}>
                      <Text style={[st.unLabel, { color: c.foreground }]} numberOfLines={1}>{categoryInfo(cat).label}</Text>
                      <Money value={v} style={[st.small, { color: c.foreground }]} />
                      <Feather name="plus-circle" size={16} color={c.primary} />
                    </PressableScale>
                  ))}
                </Card>
              ) : null}
            </>
          ) : fin.store.goals.length === 0 ? (
            <EmptyState
              icon="flag"
              title="Uma meta é uma promessa gentil"
              body="Reserva de emergência, uma viagem, um curso. Defina o alvo e registre aportes quando acontecerem."
              actionLabel="Criar meta"
              onAction={() => router.push('/goal')}
            />
          ) : (
            <>
              {fin.store.goals.map((g, i) => {
                const saved = g.contributions.reduce((a, x) => a + x.amount, 0);
                const r = g.target ? saved / g.target : 0;
                const done = saved >= g.target;
                const d = g.deadline ? daysUntil(g.deadline) : null;
                return (
                  <FadeIn key={g.id} delay={i * 40}>
                    <PressableScale testID={`goal-${g.id}`} onPress={() => router.push({ pathname: '/goal', params: { id: g.id } })} style={[st.item, { backgroundColor: c.card, borderColor: c.border }]}>
                      <View style={st.itemHead}>
                        <View style={[st.icon, { backgroundColor: done ? c.incomeSoft : c.lagoonSoft }]}>
                          <Feather name={done ? 'check' : 'flag'} size={16} color={done ? c.income : c.primary} />
                        </View>
                        <Text style={[st.itemTitle, { color: c.foreground }]} numberOfLines={1}>{g.name}</Text>
                        <Text style={[st.pct, { color: done ? c.income : c.primary }]}>{Math.min(999, Math.round(r * 100))}%</Text>
                      </View>
                      <View style={{ marginVertical: 10 }}>
                        <ProgressBar ratio={r} tone={done ? 'income' : 'primary'} height={10} />
                      </View>
                      <View style={st.rowBetween}>
                        <Money value={saved} style={[st.small, { color: c.foreground }]} />
                        <Text style={[st.small, { color: c.mutedForeground, fontFamily: F.regular }]}> de </Text>
                        <Money value={g.target} style={[st.small, { color: c.mutedForeground, flex: 1 }]} />
                        {g.deadline ? (
                          <Badge label={d !== null && d < 0 ? `prazo ${isoToBR(g.deadline)} passou` : `até ${isoToBR(g.deadline)}`} tone={d !== null && d < 0 && !done ? 'warning' : 'muted'} />
                        ) : null}
                      </View>
                      <Text style={[st.contrib, { color: c.mutedForeground }]}>
                        {g.contributions.length === 0 ? 'Nenhum aporte ainda. Toque para registrar.' : `${g.contributions.length} ${g.contributions.length === 1 ? 'aporte' : 'aportes'} registrados`}
                      </Text>
                    </PressableScale>
                  </FadeIn>
                );
              })}
              <Button label="Nova meta" icon="plus" variant="secondary" onPress={() => router.push('/goal')} />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  kicker: { fontFamily: F.semibold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  big: { fontFamily: F.bold, fontSize: 26, letterSpacing: -0.8 },
  of: { fontFamily: F.regular, fontSize: 14 },
  item: { padding: 16, borderRadius: 18, borderWidth: 1 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontFamily: F.semibold, fontSize: 15, flex: 1 },
  small: { fontSize: 13 },
  pct: { fontFamily: F.bold, fontSize: 15 },
  contrib: { fontFamily: F.regular, fontSize: 12, marginTop: 8 },
  unRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  unLabel: { fontFamily: F.medium, fontSize: 14, flex: 1 },
});
