import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { categoryInfo, KIND_LABEL } from '@/lib/categories';
import type { LedgerTx } from '@/lib/ledger';
import { F, Money, PressableScale } from '@/components/ui';
import { isoToBR } from '@/lib/format';

export function TxRow({ tx, onPress, onLongPress }: { tx: LedgerTx; onPress: () => void; onLongPress?: () => void }) {
  const c = useColors();
  const cat = categoryInfo(tx.category);
  const isIn = tx.kind === 'income';
  const isNeutral = tx.kind === 'transfer' || tx.kind === 'card_payment';
  const tint = isIn ? c.income : isNeutral ? c.mutedForeground : c.foreground;
  const iconBg = isIn ? c.incomeSoft : isNeutral ? c.muted : c.auraSoft;
  const iconFg = isIn ? c.income : isNeutral ? c.mutedForeground : c.accentForeground;
  const meta = [
    isNeutral ? KIND_LABEL[tx.kind] : cat.label,
    tx.installment ? `parcela ${tx.installment}` : null,
    tx.accountLabel,
  ].filter(Boolean).join(' · ');
  return (
    <PressableScale testID={`tx-${tx.id}`} onPress={onPress} onLongPress={onLongPress} scaleTo={0.985} style={st.row}>
      <View style={[st.icon, { backgroundColor: iconBg }]}>
        <Feather name={isNeutral ? (tx.kind === 'transfer' ? 'shuffle' : 'credit-card') : cat.icon} size={17} color={iconFg} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[st.desc, { color: c.foreground }]}>{tx.description || cat.label}</Text>
        <View style={st.metaRow}>
          <View style={[st.dot, { backgroundColor: tx.source === 'local' ? c.aura : c.primary }]} />
          <Text numberOfLines={1} style={[st.meta, { color: c.mutedForeground }]}>
            {meta || isoToBR(tx.date)}
            {tx.pending ? ' · pendente' : ''}
          </Text>
        </View>
      </View>
      <Money value={isIn ? tx.amount : -tx.amount} currency={tx.currency} signed style={[st.amount, { color: tint }]} />
    </PressableScale>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  desc: { fontFamily: F.medium, fontSize: 15 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  meta: { fontFamily: F.regular, fontSize: 12, flexShrink: 1 },
  amount: { fontSize: 15, maxWidth: 140, textAlign: 'right' },
});
