import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useFinance } from '@/context/finance';
import { sumByCurrency, useImported, useRemote } from '@/lib/ledger';
import { describeApiError, isoToBR, relativeTime } from '@/lib/format';
import {
  Badge, Button, Card, EmptyState, F, FadeIn, Money, Notice, PressableScale, ScreenHeader, Segmented,
  SectionTitle, useTabBottomPad,
} from '@/components/ui';

function Totals({ title, totals, note }: { title: string; totals: { currency: string; total: number }[]; note?: string }) {
  const c = useColors();
  const [first, ...rest] = totals;
  return (
    <View style={[st.hero, { backgroundColor: c.hero, borderRadius: c.radius + 4 }]}>
      <View style={[st.glow, { backgroundColor: c.aura }]} />
      <Text style={[st.heroLabel, { color: c.heroMuted }]}>{title}</Text>
      {first ? (
        <Money value={first.total} currency={first.currency} style={[st.heroValue, { color: c.heroForeground }]} />
      ) : (
        <Text style={[st.heroValue, { color: c.heroMuted }]}>Nada registrado</Text>
      )}
      {rest.map((t) => (
        <Money key={t.currency} value={t.total} currency={t.currency} style={[st.heroSub, { color: c.heroForeground }]} />
      ))}
      {rest.length > 0 ? <Text style={[st.heroNote, { color: c.heroMuted }]}>Moedas diferentes são somadas separadamente, sem conversão.</Text> : null}
      {note ? <Text style={[st.heroNote, { color: c.heroMuted }]}>{note}</Text> : null}
    </View>
  );
}

function Row({ icon, title, meta, value, currency, badge, onPress }: { icon: 'trending-up' | 'credit-card' | 'briefcase' | 'pocket'; title: string; meta: string; value: number | null; currency: string; badge: { label: string; tone: 'aura' | 'lagoon' }; onPress?: () => void }) {
  const c = useColors();
  return (
    <PressableScale onPress={onPress} disabled={!onPress} scaleTo={0.985} style={st.row}>
      <View style={[st.icon, { backgroundColor: badge.tone === 'aura' ? c.auraSoft : c.lagoonSoft }]}>
        <Feather name={icon} size={17} color={badge.tone === 'aura' ? c.accentForeground : c.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[st.title, { color: c.foreground }]}>{title}</Text>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4 }}>
          <Badge label={badge.label} tone={badge.tone} />
          <Text numberOfLines={1} style={[st.meta, { color: c.mutedForeground }]}>{meta}</Text>
        </View>
      </View>
      {value === null ? (
        <Text style={[st.meta, { color: c.mutedForeground }]}>sem saldo</Text>
      ) : (
        <Money value={value} currency={currency} style={[st.value, { color: c.foreground }]} />
      )}
    </PressableScale>
  );
}

export default function Portfolio() {
  const c = useColors();
  const fin = useFinance();
  const imported = useImported();
  const { auth, snapshot } = useRemote();
  const bottom = useTabBottomPad();
  const [tab, setTab] = useState<'inv' | 'acc'>('inv');

  const holdings = [
    ...fin.store.holdings.map((h) => ({ ...h, source: 'local' as const })),
    ...(imported?.investments ?? []).map((h) => ({ ...h, source: 'imported' as const })),
  ];
  const invTotals = sumByCurrency(holdings);
  const bankAccounts = [
    ...fin.store.accounts.filter((a) => a.type === 'BANK' && a.balance !== null).map((a) => ({ balance: a.balance ?? 0, currency: a.currency })),
    ...(imported?.accounts ?? []).filter((a) => a.type === 'BANK').map((a) => ({ balance: a.balance, currency: a.currency })),
  ];
  const cashTotals = sumByCurrency(bankAccounts);
  const importedCards = (imported?.accounts ?? []).filter((a) => a.type === 'CREDIT');
  const importedBanks = (imported?.accounts ?? []).filter((a) => a.type === 'BANK');
  const manualBanks = fin.store.accounts.filter((a) => a.type === 'BANK');
  const manualCards = fin.store.accounts.filter((a) => a.type === 'CREDIT');

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={auth.signedIn ? <RefreshControl refreshing={snapshot.isRefetching} onRefresh={() => void snapshot.refetch()} tintColor={c.primary} /> : undefined}
      >
        <ScreenHeader eyebrow="Patrimônio" title="O que você tem" />
        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <Segmented options={[{ value: 'inv', label: 'Investimentos' }, { value: 'acc', label: 'Contas e cartões' }]} value={tab} onChange={setTab} />
          {snapshot.error ? (
            <Notice tone="danger" title="Importação indisponível" body={describeApiError(snapshot.error)} actionLabel="Tentar de novo" onAction={() => void snapshot.refetch()} />
          ) : imported ? (
            <Text style={[st.sync, { color: c.mutedForeground }]}>
              Importado {relativeTime(fin.store.imported?.receivedAt)} · sincronizado no servidor {relativeTime(imported.lastSyncAt)}
            </Text>
          ) : null}
          {imported?.warnings.map((w) => <Notice key={w} tone="warning" title="Aviso da importação" body={w} />)}

          {tab === 'inv' ? (
            <>
              <FadeIn><Totals title="Total investido registrado" totals={invTotals} note="Valores informados por você ou pela instituição. A Áuria não calcula nem estima rentabilidade." /></FadeIn>
              {holdings.length === 0 ? (
                <EmptyState icon="trending-up" title="Nenhuma aplicação registrada" body="Anote seus investimentos com o saldo atual que aparece no app da sua corretora ou banco." actionLabel="Adicionar investimento" onAction={() => router.push('/holding')} />
              ) : (
                <>
                  <Card style={{ paddingVertical: 4 }}>
                    {holdings.map((h, i) => (
                      <View key={h.source + h.id} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border } : undefined}>
                        <Row
                          icon="trending-up"
                          title={h.name}
                          meta={[h.type, h.institution].filter(Boolean).join(' · ')}
                          value={h.balance}
                          currency={h.currency}
                          badge={h.source === 'local' ? { label: 'Neste aparelho', tone: 'aura' } : { label: 'Importado', tone: 'lagoon' }}
                          onPress={h.source === 'local' ? () => router.push({ pathname: '/holding', params: { id: h.id } }) : undefined}
                        />
                      </View>
                    ))}
                  </Card>
                  <Button label="Adicionar investimento" icon="plus" variant="secondary" onPress={() => router.push('/holding')} />
                </>
              )}
            </>
          ) : (
            <>
              <FadeIn>
                <Totals title="Saldo em contas" totals={cashTotals} note="Considera apenas contas correntes e de pagamento com saldo informado. Cartões de crédito não entram como dinheiro disponível." />
              </FadeIn>
              {importedBanks.length + importedCards.length + manualBanks.length + manualCards.length === 0 ? (
                <EmptyState
                  icon="credit-card"
                  title="Nenhuma conta por aqui"
                  body="Cadastre contas e cartões para organizar seus registros, ou entre e sincronize via Open Finance quando o servidor estiver pronto."
                  actionLabel="Adicionar conta ou cartão"
                  onAction={() => router.push('/account')}
                  secondaryLabel={auth.signedIn ? undefined : 'Conectar servidor'}
                  onSecondary={auth.signedIn ? undefined : () => router.push('/settings')}
                />
              ) : (
                <>
                  {importedBanks.length + manualBanks.length > 0 ? <SectionTitle title="Contas" /> : null}
                  {importedBanks.length + manualBanks.length > 0 ? (
                    <Card style={{ paddingVertical: 4 }}>
                      {importedBanks.map((a, i) => (
                        <View key={a.id} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border } : undefined}>
                          <Row icon="briefcase" title={a.name} meta={a.institution} value={a.balance} currency={a.currency} badge={{ label: 'Importada', tone: 'lagoon' }} />
                        </View>
                      ))}
                      {manualBanks.map((a, i) => (
                        <View key={a.id} style={i + importedBanks.length > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border } : undefined}>
                          <Row icon="pocket" title={a.name} meta={a.institution} value={a.balance} currency={a.currency} badge={{ label: 'Neste aparelho', tone: 'aura' }} onPress={() => router.push({ pathname: '/account', params: { id: a.id } })} />
                        </View>
                      ))}
                    </Card>
                  ) : null}
                  {importedCards.length + manualCards.length > 0 ? <SectionTitle title="Cartões de crédito" /> : null}
                  {importedCards.map((a) => (
                    <Card key={a.id}>
                      <View style={st.cardHead}>
                        <Feather name="credit-card" size={18} color={c.primary} />
                        <Text style={[st.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{a.name}</Text>
                        <Badge label="Importado" tone="lagoon" />
                      </View>
                      <Text style={[st.meta, { color: c.mutedForeground, marginTop: 4 }]}>{a.institution}</Text>
                      <View style={st.cardGrid}>
                        <View style={{ flex: 1 }}>
                          <Text style={[st.k, { color: c.mutedForeground }]}>Saldo informado</Text>
                          <Money value={a.balance} currency={a.currency} style={[st.value, { color: c.foreground }]} />
                        </View>
                        {a.creditLimit != null ? (
                          <View style={{ flex: 1 }}>
                            <Text style={[st.k, { color: c.mutedForeground }]}>Limite total</Text>
                            <Money value={a.creditLimit} currency={a.currency} style={[st.value, { color: c.foreground }]} />
                          </View>
                        ) : null}
                        {a.dueDate ? (
                          <View style={{ flex: 1 }}>
                            <Text style={[st.k, { color: c.mutedForeground }]}>Vencimento</Text>
                            <Text style={[st.value, { color: c.foreground, fontFamily: F.semibold }]}>{isoToBR(a.dueDate)}</Text>
                          </View>
                        ) : null}
                      </View>
                    </Card>
                  ))}
                  {manualCards.map((a) => (
                    <PressableScale key={a.id} onPress={() => router.push({ pathname: '/account', params: { id: a.id } })} style={[st.manualCard, { backgroundColor: c.card, borderColor: c.border }]}>
                      <View style={st.cardHead}>
                        <Feather name="credit-card" size={18} color={c.accentForeground} />
                        <Text style={[st.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{a.name}</Text>
                        <Badge label="Neste aparelho" tone="aura" />
                      </View>
                      <Text style={[st.meta, { color: c.mutedForeground, marginTop: 4 }]}>
                        {[a.institution, a.dueDay ? `vence todo dia ${a.dueDay}` : null].filter(Boolean).join(' · ') || 'Cartão manual'}
                      </Text>
                    </PressableScale>
                  ))}
                </>
              )}
              {importedBanks.length + importedCards.length + manualBanks.length + manualCards.length > 0 ? (
                <Button label="Adicionar conta ou cartão" icon="plus" variant="secondary" onPress={() => router.push('/account')} />
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { padding: 20, overflow: 'hidden' },
  glow: { position: 'absolute', width: 200, height: 200, borderRadius: 100, left: -80, bottom: -120, opacity: 0.16 },
  heroLabel: { fontFamily: F.medium, fontSize: 13 },
  heroValue: { fontFamily: F.bold, fontSize: 30, letterSpacing: -1, marginTop: 6 },
  heroSub: { fontSize: 18, marginTop: 6 },
  heroNote: { fontFamily: F.regular, fontSize: 12, lineHeight: 17, marginTop: 10 },
  sync: { fontFamily: F.regular, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: F.semibold, fontSize: 15 },
  meta: { fontFamily: F.regular, fontSize: 12, flexShrink: 1 },
  value: { fontSize: 15, maxWidth: 150 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardGrid: { flexDirection: 'row', gap: 12, marginTop: 14 },
  k: { fontFamily: F.medium, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  manualCard: { padding: 16, borderRadius: 18, borderWidth: 1 },
});
