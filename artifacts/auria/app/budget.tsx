import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useFinance } from '@/context/finance';
import { CATEGORIES } from '@/lib/categories';
import { amountToInput, parseAmount } from '@/lib/format';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Button, Chip, confirmAction, F, Field, showError, tap } from '@/components/ui';

export default function BudgetScreen() {
  const { id, category: preset } = useLocalSearchParams<{ id?: string; category?: string }>();
  const c = useColors();
  const fin = useFinance();
  const existing = id ? fin.store.budgets.find((b) => b.id === id) : undefined;
  const [category, setCategory] = useState(existing?.category ?? preset ?? '');
  const [limit, setLimit] = useState(existing ? amountToInput(existing.limit) : '');
  const [err, setErr] = useState<Record<string, string>>({});
  const used = new Set(fin.store.budgets.filter((b) => b.id !== existing?.id).map((b) => b.category));
  const options = CATEGORIES.filter((x) => !x.income && x.id !== 'transferencias' && x.id !== 'cartao');
  const extra = category && !CATEGORIES.some((x) => x.id === category) ? [{ id: category, label: category, icon: 'tag' as const }] : [];

  const save = async () => {
    const e: Record<string, string> = {};
    const n = parseAmount(limit);
    if (!category) e.category = 'Escolha uma categoria.';
    else if (used.has(category)) e.category = 'Já existe um orçamento para essa categoria.';
    if (!Number.isFinite(n) || n <= 0) e.limit = 'Informe um limite positivo.';
    setErr(e);
    if (Object.keys(e).length) return tap('warning');
    try {
      await fin.upsertBudget({ id: existing?.id, category, limit: n });
      tap('success');
      router.back();
    } catch (x) { showError('Não foi possível salvar', x); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ title: existing ? 'Editar orçamento' : 'Novo orçamento' }} />
      <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: 20, paddingBottom: 60 }} bottomOffset={40}>
        <Text style={[st.label, { color: c.mutedForeground }]}>Categoria</Text>
        <View style={st.wrap}>
          {[...options, ...extra].filter((x) => !used.has(x.id)).map((x) => (
            <Chip key={x.id} label={x.label} icon={x.icon} active={category === x.id} onPress={() => setCategory(x.id)} />
          ))}
        </View>
        {err.category ? <Text style={[st.err, { color: c.destructive }]}>{err.category}</Text> : null}
        <View style={{ height: 20 }} />
        <Field testID="budget-limit" label="Limite mensal (R$)" value={limit} onChangeText={setLimit} keyboardType="decimal-pad" placeholder="0,00" error={err.limit} hint="Vale para todos os meses. O progresso usa apenas gastos em reais desta categoria." />
        <Button testID="budget-save" label="Salvar orçamento" icon="check" onPress={save} />
        {existing ? (
          <Button label="Excluir orçamento" variant="danger" icon="trash-2" style={{ marginTop: 10 }} onPress={() => confirmAction('Excluir orçamento?', 'Os registros não são afetados.', 'Excluir', () => {
            fin.deleteBudget(existing.id).then(() => router.back()).catch((x) => showError('Erro', x));
          })} />
        ) : null}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const st = StyleSheet.create({
  label: { fontFamily: F.medium, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  err: { fontFamily: F.regular, fontSize: 12, marginTop: 8 },
});
