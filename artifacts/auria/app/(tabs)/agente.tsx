import React, { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAskFinanceAgent } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useFinance, type ChatMsg, type Store } from '@/context/finance';
import { summarize, useImported, useLedger, useRemote, type LedgerTx } from '@/lib/ledger';
import { categoryInfo } from '@/lib/categories';
import { describeApiError, monthLabel, isoToBR } from '@/lib/format';
import { confirmAction, F, IconButton, Notice, PressableScale, ScreenHeader, tap, useTabBottomPad } from '@/components/ui';
import type { FinanceSnapshot } from '@workspace/api-client-react';

const SUGGESTIONS = [
  'Onde mais gastei neste mês?',
  'Algum orçamento está perto de estourar?',
  'Quanto falta para minhas metas?',
  'O que mudou em relação ao mês passado?',
];

function buildContext(store: Store, ledger: LedgerTx[], imported: FinanceSnapshot | null, month: string): string {
  const s = summarize(ledger, month);
  const ctx = {
    observacao: 'Somente os dados abaixo foram compartilhados. Valores positivos; kind indica direção. Transferências e faturas não são gastos.',
    mesAtual: monthLabel(month),
    resumoBRL: { entradas: s.income, gastos: s.expense, saldo: s.balance, foraDoGasto: s.movedOut, outrasMoedas: s.otherCurrencies },
    gastosPorCategoria: Object.fromEntries(Object.entries(s.byCategory).map(([k, v]) => [categoryInfo(k).label, v])),
    orcamentos: store.budgets.map((b) => ({ categoria: categoryInfo(b.category).label, limiteMensal: b.limit, gastoNoMes: s.byCategory[b.category] ?? 0 })),
    metas: store.goals.map((g) => ({ nome: g.name, alvo: g.target, guardado: g.contributions.reduce((a, c) => a + c.amount, 0), prazo: g.deadline })),
    assinaturas: store.subscriptions.map((x) => ({ nome: x.name, valorMensal: x.amount, diaCobranca: x.billingDay, ativa: x.active, observacao: 'cadastrada manualmente; não indica cobrança confirmada' })),
    investimentos: [...store.holdings, ...(imported?.investments ?? [])].map((h) => ({ nome: h.name, tipo: h.type, saldo: h.balance, moeda: h.currency })),
    contas: (imported?.accounts ?? []).map((a) => ({ nome: a.name, tipo: a.type, saldo: a.balance, moeda: a.currency, vencimento: a.dueDate ?? null })),
    movimentacoesRecentes: ledger.slice(0, 120).map((t) => ({
      data: t.date, descricao: t.description, valor: t.amount, moeda: t.currency, tipo: t.kind, categoria: categoryInfo(t.category).label, origem: t.source,
    })),
  };
  let json = JSON.stringify(ctx);
  while (json.length > 39000 && ctx.movimentacoesRecentes.length > 0) {
    ctx.movimentacoesRecentes = ctx.movimentacoesRecentes.slice(0, Math.floor(ctx.movimentacoesRecentes.length * 0.7));
    json = JSON.stringify(ctx);
  }
  return json;
}

function Bubble({ m }: { m: ChatMsg }) {
  const c = useColors();
  const mine = m.role === 'user';
  const err = m.role === 'error';
  return (
    <View style={[st.bubbleWrap, { alignItems: mine ? 'flex-end' : 'flex-start' }]}>
      <View
        style={[
          st.bubble,
          mine
            ? { backgroundColor: c.hero, borderBottomRightRadius: 6 }
            : err
              ? { backgroundColor: c.expenseSoft, borderBottomLeftRadius: 6 }
              : { backgroundColor: c.card, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: 6 },
        ]}
      >
        <Text selectable style={[st.bubbleText, { color: mine ? c.heroForeground : err ? c.destructive : c.foreground }]}>{m.text}</Text>
      </View>
      <Text style={[st.stamp, { color: c.mutedForeground }]}>
        {mine ? (m.withContext ? 'com seus dados' : 'sem dados financeiros') : err ? 'erro' : m.model ?? 'agente'}
        {' · '}
        {isoToBR(m.at.slice(0, 10))} {m.at.slice(11, 16)}
      </Text>
    </View>
  );
}

export default function Agent() {
  const c = useColors();
  const fin = useFinance();
  const ledger = useLedger();
  const imported = useImported();
  const { auth, origin, status } = useRemote();
  const bottom = useTabBottomPad();
  const ask = useAskFinanceAgent();
  const [text, setText] = useState('');
  const [share, setShare] = useState(false);

  const blocker: { title: string; body: string; action?: string; go?: () => void } | null = !origin
    ? { title: 'Nenhum servidor definido', body: 'O agente roda no seu servidor. Defina o endereço em Ajustes.', action: 'Abrir ajustes', go: () => router.push('/settings') }
    : status.isLoading
      ? null
      : status.error
        ? { title: 'Servidor inacessível', body: describeApiError(status.error), action: 'Tentar de novo', go: () => void status.refetch() }
        : status.data && !status.data.modelConfigured
          ? { title: 'Agente ainda não configurado', body: 'O servidor não tem um modelo de IA configurado. Sem ele, nenhuma resposta é gerada aqui. Configure a chave do modelo nas variáveis do servidor e teste em Ajustes.', action: 'Ver status em Ajustes', go: () => router.push('/settings') }
          : !auth.signedIn
            ? { title: 'Entre para conversar', body: auth.available ? 'O agente só responde para a conta proprietária do servidor.' : 'Login não está disponível nesta versão do app.', action: auth.available ? 'Entrar' : undefined, go: auth.available ? () => router.push('/auth') : undefined }
            : null;

  const canSend = !blocker && !!status.data && text.trim().length > 0 && !ask.isPending;
  const data = useMemo(() => [...fin.store.chat].reverse(), [fin.store.chat]);

  const toggleShare = (v: boolean) => {
    if (!v) return setShare(false);
    confirmAction(
      'Compartilhar seus dados com o agente?',
      'Um resumo do mês, orçamentos, metas, investimentos e até 120 movimentações recentes serão enviados ao seu servidor e ao provedor de IA configurado nele, apenas nas mensagens enviadas com esta opção ativa.',
      'Compartilhar',
      () => setShare(true),
    );
  };

  const send = async () => {
    const message = text.trim();
    if (!message || !canSend) return;
    const withContext = share;
    const context = withContext ? buildContext(fin.store, ledger, imported, fin.month) : '';
    setText('');
    tap();
    try {
      await fin.appendChat({ role: 'user', text: message, withContext });
      const res = await ask.mutateAsync({ data: { message: message.slice(0, 4000), consent: withContext, context } });
      await fin.appendChat({ role: 'assistant', text: res.answer, model: res.model });
      tap('success');
    } catch (e) {
      const msg = (e as { status?: number }).status !== undefined || !(e instanceof Error) ? describeApiError(e) : e.message;
      await fin.appendChat({ role: 'error', text: msg }).catch(() => {});
    }
  };

  const empty = (
    <View style={{ transform: [{ scaleY: -1 }], paddingHorizontal: 20, paddingTop: 8 }}>
      <View style={[st.intro, { backgroundColor: c.lagoonSoft, borderRadius: c.radius }]}>
        <Feather name="book-open" size={20} color={c.primary} />
        <Text style={[st.introTitle, { color: c.foreground }]}>Um agente que só fala do que leu</Text>
        <Text style={[st.introBody, { color: c.mutedForeground }]}>
          Sem permissão, ele não recebe nenhum número seu e vai dizer isso. Com permissão, recebe um resumo dos seus registros apenas para aquela pergunta.
        </Text>
      </View>
      <Text style={[st.sugTitle, { color: c.mutedForeground }]}>Comece por aqui</Text>
      {SUGGESTIONS.map((q) => (
        <PressableScale key={q} onPress={() => { tap(); setText(q); }} style={[st.sug, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[st.sugText, { color: c.foreground }]}>{q}</Text>
          <Feather name="corner-down-left" size={14} color={c.mutedForeground} />
        </PressableScale>
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.background }} keyboardVerticalOffset={Platform.OS === 'ios' ? -bottom + 60 : 0}>
      <ScreenHeader
        eyebrow="Agente"
        title="Pergunte com calma"
        right={fin.store.chat.length > 0 ? (
          <IconButton icon="trash-2" label="Limpar conversa" onPress={() => confirmAction('Apagar conversa?', 'O histórico salvo neste aparelho será removido.', 'Apagar', () => void fin.clearChat())} />
        ) : undefined}
      />
      {blocker ? (
        <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
          <Notice tone="warning" title={blocker.title} body={blocker.body} actionLabel={blocker.action} onAction={blocker.go} />
        </View>
      ) : null}
      <FlatList
        data={data}
        inverted
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <Bubble m={item} />}
        contentContainerStyle={{ paddingVertical: 12, flexGrow: data.length === 0 ? 1 : undefined, justifyContent: data.length === 0 ? 'flex-end' : undefined }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={ask.isPending ? (
          <View style={[st.bubbleWrap, { alignItems: 'flex-start' }]}>
            <View style={[st.bubble, { backgroundColor: c.card, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth }]}>
              <Text style={[st.bubbleText, { color: c.mutedForeground }]}>Lendo e pensando…</Text>
            </View>
          </View>
        ) : undefined}
        ListEmptyComponent={empty}
      />
      <View style={[st.composer, { borderTopColor: c.border, backgroundColor: c.background, paddingBottom: bottom - 24 }]}>
        <View style={st.consentRow}>
          <Feather name={share ? 'unlock' : 'lock'} size={13} color={share ? c.accentForeground : c.mutedForeground} />
          <Text style={[st.consentText, { color: share ? c.accentForeground : c.mutedForeground }]}>
            {share ? 'Enviando resumo dos seus dados' : 'Sem dados financeiros nesta pergunta'}
          </Text>
          <Switch
            testID="consent-switch"
            value={share}
            onValueChange={toggleShare}
            trackColor={{ true: c.aura, false: c.input }}
            thumbColor={Platform.OS === 'android' ? c.card : undefined}
          />
        </View>
        <View style={[st.inputRow, { backgroundColor: c.card, borderColor: c.border }]}>
          <TextInput
            testID="chat-input"
            value={text}
            onChangeText={setText}
            placeholder={blocker ? 'Indisponível no momento' : 'Escreva sua pergunta'}
            placeholderTextColor={c.mutedForeground}
            multiline
            maxLength={4000}
            style={[st.input, { color: c.foreground }]}
          />
          <Pressable testID="chat-send" onPress={send} disabled={!canSend} style={[st.send, { backgroundColor: canSend ? c.primary : c.muted }]}>
            <Feather name="arrow-up" size={18} color={canSend ? c.primaryForeground : c.mutedForeground} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  bubbleWrap: { paddingHorizontal: 20, marginVertical: 5 },
  bubble: { maxWidth: '86%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleText: { fontFamily: F.regular, fontSize: 15, lineHeight: 21 },
  stamp: { fontFamily: F.regular, fontSize: 10, marginTop: 4, marginHorizontal: 4 },
  intro: { padding: 18, gap: 8 },
  introTitle: { fontFamily: F.semibold, fontSize: 16 },
  introBody: { fontFamily: F.regular, fontSize: 13, lineHeight: 19 },
  sugTitle: { fontFamily: F.semibold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 20, marginBottom: 8 },
  sug: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  sugText: { fontFamily: F.medium, fontSize: 14, flex: 1 },
  composer: { paddingHorizontal: 16, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  consentText: { fontFamily: F.medium, fontSize: 12, flex: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', borderRadius: 22, borderWidth: 1, paddingLeft: 14, paddingRight: 5, paddingVertical: 5 },
  input: { flex: 1, fontFamily: F.regular, fontSize: 15, maxHeight: 120, paddingVertical: 8 },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
