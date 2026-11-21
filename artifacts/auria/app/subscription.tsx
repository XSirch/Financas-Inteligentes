import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useFinance } from '@/context/finance';
import { amountToInput, parseAmount } from '@/lib/format';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Button, confirmAction, F, Field, Notice, showError, tap } from '@/components/ui';

export default function SubscriptionScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const c = useColors();
  const fin = useFinance();
  const existing = id ? fin.store.subscriptions.find((x) => x.id === id) : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [amount, setAmount] = useState(existing ? amountToInput(existing.amount) : '');
  const [day, setDay] = useState(existing ? String(existing.billingDay) : '');
  const [active, setActive] = useState(existing?.active ?? true);
  const [note, setNote] = useState(existing?.note ?? '');
  const [err, setErr] = useState<Record<string, string>>({});

  const save = async () => {
    const e: Record<string, string> = {};
    const n = parseAmount(amount);
    const d = Number(day);
    if (!name.trim()) e.name = 'Dê um nome à assinatura.';
    if (!Number.isFinite(n) || n <= 0) e.amount = 'Informe um valor mensal positivo.';
    if (!Number.isInteger(d) || d < 1 || d > 28) e.day = 'Use um dia entre 1 e 28.';
    setErr(e);
    if (Object.keys(e).length) return tap('warning');
    try {
      await fin.upsertSubscription({ id: existing?.id, name: name.trim(), amount: n, billingDay: d, active, note: note.trim() });
      tap('success');
      router.back();
    } catch (x) { showError('Não foi possível salvar', x); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ title: existing ? 'Editar assinatura' : 'Nova assinatura' }} />
      <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: 20, paddingBottom: 60 }} bottomOffset={40}>
        <Field testID="sub-name" label="Nome" value={name} onChangeText={setName} placeholder="Ex.: streaming, academia" error={err.name} />
        <Field testID="sub-amount" label="Valor mensal (R$)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0,00" error={err.amount} />
        <Field testID="sub-day" label="Dia de cobrança" value={day} onChangeText={setDay} keyboardType="number-pad" placeholder="1 a 28" maxLength={2} error={err.day} />
        <Field label="Observação" value={note} onChangeText={setNote} placeholder="Opcional" />
        <View style={[st.row, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[st.rowTitle, { color: c.foreground }]}>Ativa</Text>
            <Text style={[st.rowBody, { color: c.mutedForeground }]}>Desative para manter o registro sem somar ao total mensal.</Text>
          </View>
          <Switch testID="sub-active" value={active} onValueChange={setActive} trackColor={{ true: c.primary, false: c.input }} thumbColor={c.foreground} />
        </View>
        <Notice title="Registro manual" body="Nenhuma cobrança é detectada ou lançada automaticamente. Para registrar um pagamento, crie uma movimentação." />
        <Button testID="sub-save" label="Salvar assinatura" icon="check" onPress={save} style={{ marginTop: 16 }} />
        {existing ? (
          <Button label="Excluir assinatura" variant="danger" icon="trash-2" style={{ marginTop: 10 }} onPress={() => confirmAction('Excluir assinatura?', 'Movimentações registradas não são afetadas.', 'Excluir', () => {
            fin.deleteSubscription(existing.id).then(() => router.back()).catch((x) => showError('Erro', x));
          })} />
        ) : null}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 16 },
  rowTitle: { fontFamily: F.semibold, fontSize: 15 },
  rowBody: { fontFamily: F.regular, fontSize: 12, lineHeight: 17, marginTop: 2 },
});
