import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useFinance } from '@/context/finance';
import { amountToInput, brToISO, isoToBR, parseAmount, todayISO } from '@/lib/format';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Button, Card, confirmAction, F, Field, Money, ProgressBar, SectionTitle, showError, tap } from '@/components/ui';

export default function GoalScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const c = useColors();
  const fin = useFinance();
  const [goalId, setGoalId] = useState<string | undefined>(id);
  const goal = goalId ? fin.store.goals.find((g) => g.id === goalId) : undefined;
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(goal ? amountToInput(goal.target) : '');
  const [deadline, setDeadline] = useState(goal?.deadline ? isoToBR(goal.deadline) : '');
  const [contrib, setContrib] = useState('');
  const [contribDate, setContribDate] = useState(isoToBR(todayISO()));
  const [err, setErr] = useState<Record<string, string>>({});
  const saved = goal?.contributions.reduce((a, x) => a + x.amount, 0) ?? 0;

  const save = async () => {
    const e: Record<string, string> = {};
    const n = parseAmount(target);
    if (!name.trim()) e.name = 'Dê um nome para a meta.';
    if (!Number.isFinite(n) || n <= 0) e.target = 'Informe um valor alvo positivo.';
    const dl = deadline.trim() ? brToISO(deadline) : null;
    if (deadline.trim() && !dl) e.deadline = 'Use DD/MM/AAAA ou deixe vazio.';
    setErr(e);
    if (Object.keys(e).length) return tap('warning');
    try {
      const newId = await fin.upsertGoal({ id: goal?.id, name: name.trim(), target: n, deadline: dl });
      tap('success');
      if (!goal) setGoalId(newId);
      else router.back();
    } catch (x) { showError('Não foi possível salvar', x); }
  };

  const addContribution = async () => {
    if (!goal) return;
    const n = parseAmount(contrib);
    const d = brToISO(contribDate);
    const e: Record<string, string> = {};
    if (!Number.isFinite(n) || n <= 0) e.contrib = 'Informe um valor positivo.';
    if (!d) e.contribDate = 'Use DD/MM/AAAA.';
    setErr(e);
    if (Object.keys(e).length) return tap('warning');
    try {
      await fin.addContribution(goal.id, n, d!);
      setContrib('');
      tap('success');
    } catch (x) { showError('Não foi possível salvar', x); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ title: goal ? goal.name : 'Nova meta' }} />
      <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: 20, paddingBottom: 60 }} bottomOffset={40}>
        {goal ? (
          <Card tone="lagoon" style={{ marginBottom: 20 }}>
            <Text style={[st.k, { color: c.primary }]}>Guardado até agora</Text>
            <Money value={saved} style={[st.big, { color: c.foreground }]} />
            <View style={{ marginVertical: 10 }}><ProgressBar ratio={goal.target ? saved / goal.target : 0} tone={saved >= goal.target ? 'income' : 'primary'} height={10} /></View>
            <Text style={[st.small, { color: c.mutedForeground }]}>
              {saved >= goal.target ? 'Meta alcançada.' : 'Faltam '}
            </Text>
            {saved < goal.target ? <Money value={goal.target - saved} style={[st.small, { color: c.foreground }]} /> : null}
          </Card>
        ) : null}
        <Field testID="goal-name" label="Nome" value={name} onChangeText={setName} placeholder="Ex.: Reserva de emergência" error={err.name} maxLength={60} />
        <Field testID="goal-target" label="Valor alvo (R$)" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="0,00" error={err.target} />
        <Field label="Prazo (opcional)" value={deadline} onChangeText={setDeadline} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" maxLength={10} error={err.deadline} />
        <Button testID="goal-save" label={goal ? 'Salvar meta' : 'Criar meta'} icon="check" onPress={save} />

        {goal ? (
          <>
            <SectionTitle title="Aportes" />
            <Text style={[st.small, { color: c.mutedForeground, marginBottom: 12 }]}>Registre quando separar dinheiro para esta meta. Isto não move dinheiro de verdade.</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Field testID="contrib-amount" label="Valor" value={contrib} onChangeText={setContrib} keyboardType="decimal-pad" placeholder="0,00" error={err.contrib} /></View>
              <View style={{ flex: 1 }}><Field label="Data" value={contribDate} onChangeText={setContribDate} keyboardType="numbers-and-punctuation" maxLength={10} error={err.contribDate} /></View>
            </View>
            <Button label="Adicionar aporte" icon="plus" variant="aura" onPress={addContribution} />
            <Card style={{ marginTop: 14, paddingVertical: 4 }}>
              {goal.contributions.length === 0 ? (
                <Text style={[st.small, { color: c.mutedForeground, paddingVertical: 12 }]}>Nenhum aporte registrado.</Text>
              ) : goal.contributions.map((x, i) => (
                <View key={x.id} style={[st.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
                  <Text style={[st.small, { color: c.mutedForeground, flex: 1 }]}>{isoToBR(x.date)}</Text>
                  <Money value={x.amount} style={[st.small, { color: c.foreground }]} />
                  <Pressable hitSlop={8} onPress={() => confirmAction('Remover aporte?', 'O progresso da meta será recalculado.', 'Remover', () => void fin.removeContribution(goal.id, x.id).catch((e) => showError('Erro', e)))}>
                    <Feather name="x" size={16} color={c.mutedForeground} />
                  </Pressable>
                </View>
              ))}
            </Card>
            <Button label="Excluir meta" variant="danger" icon="trash-2" style={{ marginTop: 24 }} onPress={() => confirmAction('Excluir meta?', 'A meta e todos os aportes registrados serão removidos deste aparelho.', 'Excluir', () => {
              fin.deleteGoal(goal.id).then(() => router.back()).catch((e) => showError('Erro', e));
            })} />
          </>
        ) : null}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const st = StyleSheet.create({
  k: { fontFamily: F.semibold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' },
  big: { fontFamily: F.bold, fontSize: 28, marginTop: 4 },
  small: { fontFamily: F.regular, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
});
