import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useFinance } from '@/context/finance';
import { amountToInput, parseAmount } from '@/lib/format';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Button, Chip, confirmAction, F, Field, showError, tap } from '@/components/ui';

const TYPES = ['Renda fixa', 'Tesouro Direto', 'Ações', 'Fundos', 'FIIs', 'Previdência', 'Cripto', 'Poupança', 'Outro'];
const CURRENCIES = ['BRL', 'USD', 'EUR'];

export default function HoldingScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const c = useColors();
  const fin = useFinance();
  const h = id ? fin.store.holdings.find((x) => x.id === id) : undefined;
  const [name, setName] = useState(h?.name ?? '');
  const [type, setType] = useState(h?.type ?? 'Renda fixa');
  const [institution, setInstitution] = useState(h?.institution ?? '');
  const [balance, setBalance] = useState(h ? amountToInput(h.balance) : '');
  const [currency, setCurrency] = useState(h?.currency ?? 'BRL');
  const [err, setErr] = useState<Record<string, string>>({});

  const save = async () => {
    const e: Record<string, string> = {};
    const n = parseAmount(balance);
    if (!name.trim()) e.name = 'Informe o nome da aplicação.';
    if (!Number.isFinite(n) || n < 0) e.balance = 'Informe o saldo atual (zero ou positivo).';
    setErr(e);
    if (Object.keys(e).length) return tap('warning');
    try {
      await fin.upsertHolding({ id: h?.id, name: name.trim(), type, institution: institution.trim(), balance: n, currency });
      tap('success');
      router.back();
    } catch (x) { showError('Não foi possível salvar', x); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ title: h ? 'Editar investimento' : 'Novo investimento' }} />
      <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: 20, paddingBottom: 60 }} bottomOffset={40}>
        <Field testID="holding-name" label="Nome" value={name} onChangeText={setName} placeholder="Ex.: CDB 2027" error={err.name} maxLength={80} />
        <Text style={[st.label, { color: c.mutedForeground }]}>Tipo</Text>
        <View style={st.wrap}>{TYPES.map((t) => <Chip key={t} label={t} active={type === t} onPress={() => setType(t)} />)}</View>
        <View style={{ height: 16 }} />
        <Field label="Instituição (opcional)" value={institution} onChangeText={setInstitution} placeholder="Banco ou corretora" maxLength={60} />
        <Text style={[st.label, { color: c.mutedForeground }]}>Moeda</Text>
        <View style={st.wrap}>{CURRENCIES.map((t) => <Chip key={t} label={t} active={currency === t} onPress={() => setCurrency(t)} />)}</View>
        <View style={{ height: 16 }} />
        <Field testID="holding-balance" label={`Saldo atual (${currency})`} value={balance} onChangeText={setBalance} keyboardType="decimal-pad" placeholder="0,00" error={err.balance} hint="Copie o saldo exibido pela instituição. Atualize quando quiser; a Áuria não estima rendimentos." />
        <Button testID="holding-save" label="Salvar" icon="check" onPress={save} />
        {h ? <Button label="Excluir investimento" variant="danger" icon="trash-2" style={{ marginTop: 10 }} onPress={() => confirmAction('Excluir investimento?', `"${h.name}" será removido deste aparelho.`, 'Excluir', () => {
          fin.deleteHolding(h.id).then(() => router.back()).catch((x) => showError('Erro', x));
        })} /> : null}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const st = StyleSheet.create({
  label: { fontFamily: F.medium, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
