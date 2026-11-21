import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useFinance, type Kind } from '@/context/finance';
import { useLedger } from '@/lib/ledger';
import { CATEGORIES, categoryInfo, KIND_LABEL } from '@/lib/categories';
import { amountToInput, brToISO, isoToBR, parseAmount, todayISO } from '@/lib/format';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Badge, Button, Card, Chip, confirmAction, F, Field, Money, Segmented, showError, tap } from '@/components/ui';

function CategoryPicker({ value, onChange, kind }: { value: string; onChange: (v: string) => void; kind: Kind }) {
  const c = useColors();
  const list = [...CATEGORIES].sort((a, b) => (kind === 'income' ? Number(!!b.income) - Number(!!a.income) : Number(!!a.income) - Number(!!b.income)));
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[st.label, { color: c.mutedForeground }]}>Categoria</Text>
      <View style={st.wrap}>
        {list.map((cat) => (
          <Chip key={cat.id} label={cat.label} icon={cat.icon} active={value === cat.id} onPress={() => onChange(cat.id)} />
        ))}
      </View>
    </View>
  );
}

function ImportedEditor({ id }: { id: string }) {
  const c = useColors();
  const fin = useFinance();
  const tx = useLedger().find((t) => t.source === 'imported' && t.id === id);
  if (!tx) {
    return (
      <View style={{ padding: 20 }}>
        <Text style={[st.body, { color: c.mutedForeground }]}>Este registro importado não está mais disponível. Ele pode ter sido removido na última sincronização ou você saiu da conta.</Text>
      </View>
    );
  }
  const overridden = tx.category !== tx.originalCategory;
  const choose = (cat: string) => {
    fin.setOverride(id, cat === tx.originalCategory ? null : cat).then(() => tap('success')).catch((e) => showError('Não foi possível salvar', e));
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <Card>
        <Badge label="Importado · somente leitura" tone="lagoon" icon="lock" />
        <Text style={[st.desc, { color: c.foreground }]}>{tx.description}</Text>
        <Money value={tx.amount} currency={tx.currency} style={[st.amount, { color: c.foreground }]} />
        <Text style={[st.body, { color: c.mutedForeground }]}>
          {KIND_LABEL[tx.kind]} · {isoToBR(tx.date)}
          {tx.accountLabel ? ` · ${tx.accountLabel}` : ''}
          {tx.installment ? ` · parcela ${tx.installment}` : ''}
          {tx.pending ? ' · pendente' : ''}
        </Text>
        <Text style={[st.body, { color: c.mutedForeground, marginTop: 6 }]}>Categoria original: {categoryInfo(tx.originalCategory).label}</Text>
      </Card>
      <Text style={[st.help, { color: c.mutedForeground }]}>
        Você pode reclassificar a categoria. A mudança fica salva só neste aparelho; o dado no servidor continua igual.
      </Text>
      <CategoryPicker value={tx.category} onChange={choose} kind={tx.kind} />
      {overridden ? <Button label="Restaurar categoria original" variant="ghost" icon="rotate-ccw" onPress={() => choose(tx.originalCategory)} /> : null}
    </ScrollView>
  );
}

export default function TransactionScreen() {
  const params = useLocalSearchParams<{ id?: string; importedId?: string }>();
  const c = useColors();
  const fin = useFinance();
  const existing = params.id ? fin.store.transactions.find((t) => t.id === params.id) : undefined;
  const [kind, setKind] = useState<Kind>(existing?.kind ?? 'expense');
  const [amount, setAmount] = useState(existing ? amountToInput(existing.amount) : '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [category, setCategory] = useState(existing?.category ?? 'outros');
  const [date, setDate] = useState(isoToBR(existing?.date ?? todayISO()));
  const [accountId, setAccountId] = useState<string | null>(existing?.accountId ?? null);
  const [note, setNote] = useState(existing?.note ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (params.importedId) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <Stack.Screen options={{ title: 'Registro importado' }} />
        <ImportedEditor id={params.importedId} />
      </View>
    );
  }

  const save = async () => {
    const e: Record<string, string> = {};
    const n = parseAmount(amount);
    if (!Number.isFinite(n) || n <= 0) e.amount = 'Informe um valor positivo, ex.: 1.234,56';
    if (n > 1e10) e.amount = 'Valor muito alto.';
    const iso = brToISO(date);
    if (!iso) e.date = 'Use o formato DD/MM/AAAA.';
    if (!description.trim()) e.description = 'Dê um nome curto para lembrar depois.';
    setErrors(e);
    if (Object.keys(e).length) { tap('warning'); return; }
    setSaving(true);
    try {
      const cat = kind === 'transfer' ? 'transferencias' : kind === 'card_payment' ? 'cartao' : category;
      await fin.upsertTx({ id: existing?.id, kind, amount: n, description: description.trim(), category: cat, date: iso!, accountId, note: note.trim() });
      tap('success');
      router.back();
    } catch (err) {
      showError('Não foi possível salvar', err);
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    confirmAction('Excluir movimentação?', 'Ela será removida deste aparelho.', 'Excluir', () => {
      fin.deleteTx(existing!.id).then(() => { tap('success'); router.back(); }).catch((e) => showError('Não foi possível excluir', e));
    });

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ title: existing ? 'Editar movimentação' : 'Nova movimentação' }} />
      <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: 20, paddingBottom: 60 }} bottomOffset={40}>
        <Badge label="Salvo neste aparelho" tone="aura" icon="smartphone" />
        <View style={{ height: 14 }} />
        <Segmented
          options={[
            { value: 'expense', label: 'Saída' },
            { value: 'income', label: 'Entrada' },
            { value: 'transfer', label: 'Transf.' },
            { value: 'card_payment', label: 'Fatura' },
          ]}
          value={kind}
          onChange={setKind}
        />
        {kind === 'transfer' || kind === 'card_payment' ? (
          <Text style={[st.help, { color: c.mutedForeground }]}>
            {kind === 'transfer' ? 'Transferências entre suas contas' : 'Pagamentos de fatura'} não entram nos gastos, porque as compras já foram registradas.
          </Text>
        ) : <View style={{ height: 16 }} />}
        <Field testID="tx-amount" label="Valor (R$)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0,00" error={errors.amount} style={st.bigInput} />
        <Field testID="tx-description" label="Descrição" value={description} onChangeText={setDescription} placeholder="Ex.: Feira de sábado" error={errors.description} maxLength={120} />
        <Field testID="tx-date" label="Data" value={date} onChangeText={setDate} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" error={errors.date} maxLength={10} />
        {kind === 'income' || kind === 'expense' ? <CategoryPicker value={category} onChange={setCategory} kind={kind} /> : null}
        {fin.store.accounts.length > 0 ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={[st.label, { color: c.mutedForeground }]}>Conta ou cartão (opcional)</Text>
            <View style={st.wrap}>
              <Chip label="Nenhuma" active={!accountId} onPress={() => setAccountId(null)} />
              {fin.store.accounts.map((a) => (
                <Chip key={a.id} label={a.name} icon={a.type === 'CREDIT' ? 'credit-card' : 'pocket'} active={accountId === a.id} onPress={() => setAccountId(a.id)} />
              ))}
            </View>
          </View>
        ) : null}
        <Field label="Observação (opcional)" value={note} onChangeText={setNote} placeholder="Algo para lembrar" multiline maxLength={400} />
        <Button testID="tx-save" label={existing ? 'Salvar alterações' : 'Registrar'} icon="check" onPress={save} loading={saving} />
        {existing ? <Button label="Excluir" variant="danger" icon="trash-2" onPress={remove} style={{ marginTop: 10 }} /> : null}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const st = StyleSheet.create({
  label: { fontFamily: F.medium, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  help: { fontFamily: F.regular, fontSize: 13, lineHeight: 19, marginVertical: 14 },
  bigInput: { fontFamily: F.bold, fontSize: 26 },
  desc: { fontFamily: F.semibold, fontSize: 18, marginTop: 12 },
  amount: { fontSize: 28, marginTop: 6 },
  body: { fontFamily: F.regular, fontSize: 13, lineHeight: 19, marginTop: 4 },
});
