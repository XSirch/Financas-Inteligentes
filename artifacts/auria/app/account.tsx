import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useFinance } from '@/context/finance';
import { amountToInput, parseAmount } from '@/lib/format';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Button, Chip, confirmAction, F, Field, Segmented, showError, tap } from '@/components/ui';

export default function AccountScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const c = useColors();
  const fin = useFinance();
  const a = id ? fin.store.accounts.find((x) => x.id === id) : undefined;
  const [type, setType] = useState<'BANK' | 'CREDIT'>(a?.type ?? 'BANK');
  const [name, setName] = useState(a?.name ?? '');
  const [institution, setInstitution] = useState(a?.institution ?? '');
  const [balance, setBalance] = useState(a?.balance != null ? amountToInput(a.balance) : '');
  const [currency, setCurrency] = useState(a?.currency ?? 'BRL');
  const [dueDay, setDueDay] = useState(a?.dueDay ? String(a.dueDay) : '');
  const [err, setErr] = useState<Record<string, string>>({});

  const save = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Informe um nome.';
    let bal: number | null = null;
    if (type === 'BANK' && balance.trim()) {
      const neg = balance.trim().startsWith('-');
      const n = parseAmount(balance.replace('-', ''));
      if (!Number.isFinite(n)) e.balance = 'Valor inválido.';
      else bal = neg ? -n : n;
    }
    let dd: number | null = null;
    if (type === 'CREDIT' && dueDay.trim()) {
      dd = Number(dueDay);
      if (!Number.isInteger(dd) || dd < 1 || dd > 31) e.dueDay = 'Dia entre 1 e 31.';
    }
    setErr(e);
    if (Object.keys(e).length) return tap('warning');
    try {
      await fin.upsertAccount({ id: a?.id, type, name: name.trim(), institution: institution.trim(), balance: bal, currency, dueDay: dd });
      tap('success');
      router.back();
    } catch (x) { showError('Não foi possível salvar', x); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ title: a ? 'Editar' : 'Nova conta ou cartão' }} />
      <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: 20, paddingBottom: 60 }} bottomOffset={40}>
        <Segmented options={[{ value: 'BANK', label: 'Conta' }, { value: 'CREDIT', label: 'Cartão de crédito' }]} value={type} onChange={setType} />
        <View style={{ height: 18 }} />
        <Field testID="account-name" label="Nome" value={name} onChangeText={setName} placeholder={type === 'BANK' ? 'Ex.: Conta corrente' : 'Ex.: Cartão principal'} error={err.name} maxLength={60} />
        <Field label="Instituição (opcional)" value={institution} onChangeText={setInstitution} maxLength={60} />
        {type === 'BANK' ? (
          <>
            <Text style={[st.label, { color: c.mutedForeground }]}>Moeda</Text>
            <View style={st.wrap}>{['BRL', 'USD', 'EUR'].map((t) => <Chip key={t} label={t} active={currency === t} onPress={() => setCurrency(t)} />)}</View>
            <View style={{ height: 16 }} />
            <Field label="Saldo atual (opcional)" value={balance} onChangeText={setBalance} keyboardType="numbers-and-punctuation" placeholder="Deixe vazio se não quiser acompanhar" error={err.balance} hint="Informado por você. Não é atualizado automaticamente pelos registros." />
          </>
        ) : (
          <Field label="Dia de vencimento (opcional)" value={dueDay} onChangeText={setDueDay} keyboardType="number-pad" maxLength={2} placeholder="Ex.: 10" error={err.dueDay} hint="Usado só para lembrar o vencimento na Visão. Não calculamos limite disponível nem faturas futuras." />
        )}
        <Button testID="account-save" label="Salvar" icon="check" onPress={save} />
        {a ? <Button label="Excluir" variant="danger" icon="trash-2" style={{ marginTop: 10 }} onPress={() => confirmAction('Excluir conta?', 'Os registros ligados a ela continuam, sem conta associada.', 'Excluir', () => {
          fin.deleteAccount(a.id).then(() => router.back()).catch((x) => showError('Erro', x));
        })} /> : null}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const st = StyleSheet.create({
  label: { fontFamily: F.medium, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
