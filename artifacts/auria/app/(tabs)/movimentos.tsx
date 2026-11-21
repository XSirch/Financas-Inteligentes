import React, { useMemo, useState } from 'react';
import { Alert, Platform, SectionList, StyleSheet, Text, TextInput, View, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useFinance } from '@/context/finance';
import { summarize, useImported, useLedger, type LedgerTx } from '@/lib/ledger';
import { categoryInfo } from '@/lib/categories';
import { dayLabel } from '@/lib/format';
import { Chip, EmptyState, F, Money, MonthNav, PressableScale, ScreenHeader, tap, useTabBottomPad } from '@/components/ui';
import { TxRow } from '@/components/TxRow';

type Filter = 'all' | 'income' | 'expense' | 'transfer' | 'card_payment' | 'local' | 'imported';
const FILTERS: { v: Filter; label: string }[] = [
  { v: 'all', label: 'Tudo' },
  { v: 'expense', label: 'Saídas' },
  { v: 'income', label: 'Entradas' },
  { v: 'transfer', label: 'Transferências' },
  { v: 'card_payment', label: 'Faturas' },
  { v: 'local', label: 'Neste aparelho' },
  { v: 'imported', label: 'Importados' },
];

export default function Movements() {
  const c = useColors();
  const fin = useFinance();
  const ledger = useLedger();
  const imported = useImported();
  const bottom = useTabBottomPad();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const monthTx = useMemo(() => ledger.filter((t) => t.date.startsWith(fin.month)), [ledger, fin.month]);
  const summary = useMemo(() => summarize(ledger, fin.month), [ledger, fin.month]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return monthTx.filter((t) => {
      if (filter === 'local' && t.source !== 'local') return false;
      if (filter === 'imported' && t.source !== 'imported') return false;
      if (['income', 'expense', 'transfer', 'card_payment'].includes(filter) && t.kind !== filter) return false;
      if (!needle) return true;
      return (
        t.description.toLowerCase().includes(needle) ||
        categoryInfo(t.category).label.toLowerCase().includes(needle) ||
        (t.accountLabel ?? '').toLowerCase().includes(needle) ||
        t.note.toLowerCase().includes(needle)
      );
    });
  }, [monthTx, q, filter]);

  const sections = useMemo(() => {
    const map = new Map<string, LedgerTx[]>();
    filtered.forEach((t) => map.set(t.date, [...(map.get(t.date) ?? []), t]));
    return [...map.entries()].map(([date, data]) => ({ title: date, data }));
  }, [filtered]);

  const confirmDelete = (t: LedgerTx) => {
    if (t.source !== 'local') return;
    const go = () => {
      fin.deleteTx(t.id).then(() => tap('success')).catch((e: Error) => Alert.alert('Não foi possível excluir', e.message));
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Excluir "${t.description}"?`)) go();
      return;
    }
    tap('warning');
    Alert.alert('Excluir movimentação?', `"${t.description}" será removida deste aparelho.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: go },
    ]);
  };

  const header = (
    <View>
      <ScreenHeader eyebrow="Movimentos" title="O que entrou e saiu" />
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        <MonthNav />
        <View style={[st.search, { backgroundColor: c.card, borderColor: c.border }]}>
          <Feather name="search" size={16} color={c.mutedForeground} />
          <TextInput
            testID="search"
            value={q}
            onChangeText={setQ}
            placeholder="Buscar descrição, categoria ou conta"
            placeholderTextColor={c.mutedForeground}
            style={[st.searchInput, { color: c.foreground }]}
            returnKeyType="search"
          />
          {q ? <Feather name="x" size={16} color={c.mutedForeground} onPress={() => setQ('')} /> : null}
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
        {FILTERS.filter((f) => f.v !== 'imported' || imported).map((f) => (
          <Chip key={f.v} label={f.label} active={filter === f.v} onPress={() => setFilter(f.v)} />
        ))}
      </ScrollView>
      {monthTx.length > 0 ? (
        <View style={[st.totals, { borderColor: c.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[st.tLabel, { color: c.mutedForeground }]}>Entradas</Text>
            <Money value={summary.income} style={[st.tVal, { color: c.income }]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[st.tLabel, { color: c.mutedForeground }]}>Gastos</Text>
            <Money value={summary.expense} style={[st.tVal, { color: c.expense }]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[st.tLabel, { color: c.mutedForeground }]}>Fora do gasto</Text>
            <Money value={summary.movedOut} style={[st.tVal, { color: c.mutedForeground }]} />
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.source + t.id}
        ListHeaderComponent={header}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: bottom + 40 }}
        renderSectionHeader={({ section }) => (
          <Text style={[st.day, { color: c.mutedForeground }]}>{dayLabel(section.title)}</Text>
        )}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 20 }}>
            <TxRow
              tx={item}
              onPress={() => router.push({ pathname: '/transaction', params: item.source === 'local' ? { id: item.id } : { importedId: item.id } })}
              onLongPress={item.source === 'local' ? () => confirmDelete(item) : undefined}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
            {monthTx.length === 0 ? (
              <EmptyState
                icon="book-open"
                title="Página em branco"
                body="Nenhuma movimentação neste mês. Registre manualmente; tudo fica salvo só neste aparelho."
                actionLabel="Nova movimentação"
                onAction={() => router.push('/transaction')}
              />
            ) : (
              <EmptyState icon="filter" title="Nada com esse filtro" body="Tente outra palavra ou volte para Tudo." secondaryLabel="Limpar filtros" onSecondary={() => { setQ(''); setFilter('all'); }} />
            )}
          </View>
        }
        ListFooterComponent={
          sections.length > 0 ? (
            <Text style={[st.hint, { color: c.mutedForeground }]}>Toque para editar. Segure um registro manual para excluir.</Text>
          ) : undefined
        }
      />
      <PressableScale
        testID="add-transaction"
        onPress={() => { tap(); router.push('/transaction'); }}
        scaleTo={0.92}
        style={[st.fab, { backgroundColor: c.hero, bottom: bottom - 16 }]}
      >
        <Feather name="plus" size={20} color={c.heroForeground} />
        <Text style={[st.fabText, { color: c.heroForeground }]}>Registrar</Text>
      </PressableScale>
    </View>
  );
}

const st = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, height: 46 },
  searchInput: { flex: 1, fontFamily: F.regular, fontSize: 15, height: 46 },
  chips: { gap: 8, paddingHorizontal: 20, paddingVertical: 14 },
  totals: { flexDirection: 'row', marginHorizontal: 20, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  tLabel: { fontFamily: F.medium, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  tVal: { fontSize: 15, marginTop: 3 },
  day: { fontFamily: F.semibold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 20, marginTop: 18, marginBottom: 2 },
  hint: { fontFamily: F.regular, fontSize: 12, textAlign: 'center', marginTop: 20 },
  fab: { position: 'absolute', right: 20, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, height: 52, borderRadius: 26, shadowColor: '#05080C', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  fabText: { fontFamily: F.semibold, fontSize: 15 },
});
