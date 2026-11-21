import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useFinance } from '@/context/finance';
import { computeAlerts, summarize, useImported, useLedger, useRemote } from '@/lib/ledger';
import { currentMonthKey, describeApiError, monthLabel, relativeTime } from '@/lib/format';
import {
  Badge, Card, EmptyState, F, FadeIn, IconButton, Money, MonthNav, Notice, PressableScale,
  ScreenHeader, SectionTitle, Skeleton, tap, useTabBottomPad,
} from '@/components/ui';
import { TxRow } from '@/components/TxRow';

function AuraRing({ ratio, empty }: { ratio: number; empty: boolean }) {
  const c = useColors();
  const size = 112;
  const r = 46;
  const circ = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, ratio));
  return (
    <Svg width={size} height={size} viewBox="0 0 112 112">
      <Circle cx={56} cy={56} r={r} stroke={c.heroMuted} strokeOpacity={0.25} strokeWidth={10} fill="none" strokeDasharray={empty ? '2 6' : undefined} />
      {!empty ? (
        <Circle
          cx={56} cy={56} r={r} stroke={ratio > 1 ? c.expense : c.aura} strokeWidth={10} fill="none"
          strokeLinecap="round" strokeDasharray={`${circ * p} ${circ}`} transform="rotate(-90 56 56)"
        />
      ) : null}
    </Svg>
  );
}

export default function Overview() {
  const c = useColors();
  const fin = useFinance();
  const { store, month, hydrated } = fin;
  const ledger = useLedger();
  const imported = useImported();
  const { auth, origin, status, snapshot } = useRemote();
  const bottom = useTabBottomPad();
  const summary = useMemo(() => summarize(ledger, month), [ledger, month]);
  const isNow = month === currentMonthKey();
  const alerts = useMemo(() => computeAlerts(store, imported, summary, isNow), [store, imported, summary, isNow]);
  const latest = useMemo(() => ledger.filter((t) => t.date.startsWith(month)).slice(0, 6), [ledger, month]);
  const hasAny = summary.count > 0;
  const ratio = summary.income > 0 ? summary.expense / summary.income : summary.expense > 0 ? 1 : 0;

  const steps = [
    { done: store.transactions.length > 0 || store.budgets.length > 0, label: 'Registrar algo neste aparelho', hint: 'Funciona sem servidor e sem conta.' },
    { done: !!status.data, label: 'Servidor alcançável', hint: status.error ? describeApiError(status.error) : origin ? origin.replace('https://', '') : 'Nenhum servidor definido' },
    { done: auth.signedIn, label: 'Conta conectada', hint: auth.available ? (auth.signedIn ? auth.email ?? 'Sessão ativa' : 'Necessária para dados importados') : 'Login indisponível nesta versão' },
    {
      done: !!imported && (imported.accounts.length > 0 || imported.transactions.length > 0),
      label: 'Dados importados',
      hint: snapshot.error ? describeApiError(snapshot.error) : status.data?.pluggyConfigured ? `Última sincronização: ${relativeTime(status.data.lastSyncAt)}` : 'Open Finance (Pluggy) não configurado',
    },
  ];
  const allDone = steps.every((s) => s.done);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottom }} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          eyebrow="Áuria"
          title="Seu mês, com calma"
          right={
            <>
              <IconButton
                testID="toggle-privacy"
                icon={store.settings.hideAmounts ? 'eye-off' : 'eye'}
                label="Ocultar valores"
                onPress={() => void fin.setHideAmounts(!store.settings.hideAmounts)}
              />
              <IconButton testID="open-settings" icon="sliders" label="Ajustes" onPress={() => router.push('/settings')} />
            </>
          }
        />
        <View style={st.pad}>
          <MonthNav />
          {fin.loadError ? <View style={{ marginTop: 12 }}><Notice tone="danger" title="Problema ao carregar" body={fin.loadError} /></View> : null}
          {fin.persistError ? <View style={{ marginTop: 12 }}><Notice tone="danger" title="Falha ao salvar" body={fin.persistError} /></View> : null}

          <FadeIn delay={60}>
            <View style={[st.hero, { backgroundColor: c.hero, borderRadius: c.radius + 6, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border }]}>
              <View style={[st.glow, { backgroundColor: c.aura }]} />
              <View style={st.heroTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[st.heroLabel, { color: c.heroMuted }]}>Saldo de {monthLabel(month)}</Text>
                  {!hydrated ? (
                    <Skeleton height={36} width={160} style={{ marginTop: 8, opacity: 0.3 }} />
                  ) : hasAny ? (
                    <Money value={summary.balance} style={[st.heroValue, { color: c.heroForeground }]} />
                  ) : (
                    <Text style={[st.heroValue, { color: c.heroMuted }]}>Sem registros</Text>
                  )}
                  <View style={st.heroBadges}>
                    <View style={[st.modePill, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                      <View style={[st.dot, { backgroundColor: c.aura }]} />
                      <Text style={[st.modeText, { color: c.heroForeground }]}>Neste aparelho · {summary.localCount}</Text>
                    </View>
                    {imported ? (
                      <View style={[st.modePill, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                        <View style={[st.dot, { backgroundColor: c.heroMuted }]} />
                        <Text style={[st.modeText, { color: c.heroForeground }]}>Importados · {summary.importedCount}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <AuraRing ratio={ratio} empty={!hasAny || summary.income === 0 && summary.expense === 0} />
                  <View style={st.ringCenter}>
                    <Text style={[st.ringValue, { color: c.heroForeground }]}>
                      {summary.income > 0 && !store.settings.hideAmounts ? `${Math.round(ratio * 100)}%` : '—'}
                    </Text>
                    <Text style={[st.ringLabel, { color: c.heroMuted }]}>gasto/renda</Text>
                  </View>
                </View>
              </View>
              <View style={[st.split, { borderTopColor: 'rgba(255,255,255,0.1)' }]}>
                <View style={{ flex: 1 }}>
                  <View style={st.splitHead}><Feather name="arrow-down-left" size={13} color={c.heroMuted} /><Text style={[st.splitLabel, { color: c.heroMuted }]}>Entradas</Text></View>
                  <Money value={summary.income} style={[st.splitValue, { color: c.heroForeground }]} />
                </View>
                <View style={[st.vr, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                <View style={{ flex: 1 }}>
                  <View style={st.splitHead}><Feather name="arrow-up-right" size={13} color={c.heroMuted} /><Text style={[st.splitLabel, { color: c.heroMuted }]}>Saídas</Text></View>
                  <Money value={summary.expense} style={[st.splitValue, { color: c.heroForeground }]} />
                </View>
              </View>
              {summary.movedOut > 0 ? (
                <Text style={[st.footnote, { color: c.heroMuted }]}>
                  Transferências e pagamentos de fatura ficam fora dos gastos para não contar duas vezes.
                </Text>
              ) : null}
              {summary.cardCredits > 0 ? (
                <Text style={[st.footnote, { color: c.heroMuted }]}>
                  Créditos em cartão (como estornos) não são contados como entradas.
                </Text>
              ) : null}
              {summary.otherCurrencies.length > 0 ? (
                <Text style={[st.footnote, { color: c.heroMuted }]}>
                  Valores em {summary.otherCurrencies.join(', ')} não entram nos totais em reais.
                </Text>
              ) : null}
            </View>
          </FadeIn>

          {alerts.length > 0 ? (
            <FadeIn delay={120}>
              <SectionTitle title="Pede atenção" />
              <View style={{ gap: 8 }}>
                {alerts.map((a) => (
                  <PressableScale key={a.id} onPress={() => router.push(a.id.startsWith('b') || a.id.startsWith('g') ? '/plano' : '/patrimonio')} style={[st.alert, { backgroundColor: a.tone === 'danger' ? c.expenseSoft : a.tone === 'warning' ? c.warningSoft : c.lagoonSoft }]}>
                    <Feather name={a.icon} size={17} color={a.tone === 'danger' ? c.destructive : a.tone === 'warning' ? c.warning : c.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[st.alertTitle, { color: c.foreground }]}>{a.title}</Text>
                      <Text style={[st.alertBody, { color: c.mutedForeground }]}>{a.body}</Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={c.mutedForeground} />
                  </PressableScale>
                ))}
              </View>
            </FadeIn>
          ) : null}

          <SectionTitle title="Últimos registros" action={hasAny ? 'Ver todos' : undefined} onAction={() => router.push('/movimentos')} />
          {!hydrated ? (
            <Card><Skeleton /><Skeleton style={{ marginTop: 12 }} /><Skeleton style={{ marginTop: 12 }} width="60%" /></Card>
          ) : latest.length === 0 ? (
            <EmptyState
              icon="feather"
              title={`Nada anotado em ${monthLabel(month).split(' ')[0]}`}
              body="Cada número aqui vem de algo que você registrou ou importou. Comece pelo que lembrar: um salário, o aluguel, o café de hoje."
              actionLabel="Registrar movimentação"
              onAction={() => router.push('/transaction')}
            />
          ) : (
            <Card style={{ paddingVertical: 6 }}>
              {latest.map((t, i) => (
                <View key={t.source + t.id} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border } : undefined}>
                  <TxRow tx={t} onPress={() => router.push({ pathname: '/transaction', params: t.source === 'local' ? { id: t.id } : { importedId: t.id } })} />
                </View>
              ))}
              <PressableScale onPress={() => router.push('/transaction')} style={[st.addRow, { borderTopColor: c.border }]}>
                <Feather name="plus" size={16} color={c.primary} />
                <Text style={[st.addText, { color: c.primary }]}>Registrar outra</Text>
              </PressableScale>
            </Card>
          )}

          <SectionTitle title={allDone ? 'Tudo conectado' : 'Seu caminho na Áuria'} action="Ajustes" onAction={() => router.push('/settings')} />
          <Card>
            {steps.map((s, i) => (
              <View key={s.label} style={[st.step, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
                <View style={[st.stepDot, { backgroundColor: s.done ? c.primary : 'transparent', borderColor: s.done ? c.primary : c.input }]}>
                  {s.done ? <Feather name="check" size={12} color={c.primaryForeground} /> : <Text style={[st.stepNum, { color: c.mutedForeground }]}>{i + 1}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.stepLabel, { color: c.foreground }]}>{s.label}</Text>
                  <Text style={[st.stepHint, { color: c.mutedForeground }]} numberOfLines={3}>{s.hint}</Text>
                </View>
                {status.isFetching && i === 1 ? <Badge label="testando" tone="muted" /> : null}
              </View>
            ))}
            {!auth.signedIn && auth.available ? (
              <PressableScale onPress={() => { tap(); router.push('/auth'); }} style={[st.addRow, { borderTopColor: c.border }]}>
                <Feather name="log-in" size={16} color={c.primary} />
                <Text style={[st.addText, { color: c.primary }]}>Entrar para importar</Text>
              </PressableScale>
            ) : null}
          </Card>
          <Text style={[st.privacy, { color: c.mutedForeground }]}>
            Registros manuais ficam apenas neste aparelho e não são enviados ao servidor nem copiados para lá.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  pad: { paddingHorizontal: 20 },
  hero: { marginTop: 16, padding: 20, overflow: 'hidden' },
  glow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, right: -90, top: -110, opacity: 0.18 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroLabel: { fontFamily: F.medium, fontSize: 13, textTransform: 'none' },
  heroValue: { fontFamily: F.bold, fontSize: 32, letterSpacing: -1.2, marginTop: 6 },
  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  modePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  modeText: { fontFamily: F.medium, fontSize: 11 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringValue: { fontFamily: F.bold, fontSize: 18 },
  ringLabel: { fontFamily: F.regular, fontSize: 10, marginTop: 1 },
  split: { flexDirection: 'row', marginTop: 18, paddingTop: 16, borderTopWidth: 1, gap: 16 },
  splitHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  splitLabel: { fontFamily: F.medium, fontSize: 12 },
  splitValue: { fontSize: 18, marginTop: 4 },
  vr: { width: 1 },
  footnote: { fontFamily: F.regular, fontSize: 12, lineHeight: 17, marginTop: 12 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16 },
  alertTitle: { fontFamily: F.semibold, fontSize: 14 },
  alertBody: { fontFamily: F.regular, fontSize: 13, marginTop: 2 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth },
  addText: { fontFamily: F.semibold, fontSize: 14 },
  step: { flexDirection: 'row', gap: 12, paddingVertical: 12, alignItems: 'center' },
  stepDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontFamily: F.semibold, fontSize: 11 },
  stepLabel: { fontFamily: F.semibold, fontSize: 14 },
  stepHint: { fontFamily: F.regular, fontSize: 12, marginTop: 2, lineHeight: 17 },
  privacy: { fontFamily: F.regular, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 20, paddingHorizontal: 12 },
});
