import React, { useState } from 'react';
import { Platform, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { getGetFinanceSnapshotQueryKey, useSyncFinance } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { DEFAULT_ORIGIN, useFinance } from '@/context/finance';
import { useRemote } from '@/lib/ledger';
import { describeApiError, relativeTime, validateOrigin } from '@/lib/format';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Badge, Button, Card, confirmAction, F, Field, Notice, SectionTitle, showError, Skeleton, tap } from '@/components/ui';

function Row({ label, value, tone }: { label: string; value: string; tone?: 'income' | 'warning' | 'muted' }) {
  const c = useColors();
  return (
    <View style={st.kv}>
      <Text style={[st.kvLabel, { color: c.mutedForeground }]}>{label}</Text>
      {tone ? <Badge label={value} tone={tone} /> : <Text style={[st.kvValue, { color: c.foreground }]} selectable numberOfLines={2}>{value}</Text>}
    </View>
  );
}

export default function SettingsScreen() {
  const c = useColors();
  const fin = useFinance();
  const qc = useQueryClient();
  const { auth, origin, scope, status, snapshot } = useRemote();
  const sync = useSyncFinance();
  const [draft, setDraft] = useState(fin.store.settings.serverOrigin ?? '');
  const [originErr, setOriginErr] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null);

  const saveOrigin = () => {
    const r = validateOrigin(draft);
    if ('error' in r) { setOriginErr(r.error); tap('warning'); return; }
    setOriginErr(null);
    if (r.origin === fin.store.settings.serverOrigin) return;
    confirmAction(
      'Confiar neste servidor?',
      `${r.origin}\n\nQuando você estiver conectado, o token da sua sessão será enviado a este endereço. Use apenas um servidor que você controla. Dados importados e a conversa com o agente serão limpos; registros locais permanecem.`,
      'Confiar e salvar',
      () => {
        void (async () => {
          try {
            await fin.setServerOrigin(r.origin);
            await fin.clearChat();
            tap('success');
          } catch (x) { showError('Não foi possível salvar', x); }
        })();
      },
    );
  };

  const resetOrigin = () =>
    confirmAction('Usar o endereço padrão?', DEFAULT_ORIGIN ? `Voltará para ${DEFAULT_ORIGIN}. Dados importados e a conversa serão limpos.` : 'Nenhum servidor ficará definido. Dados importados e a conversa serão limpos.', 'Confirmar', () => {
      void (async () => {
        try { await fin.setServerOrigin(null); await fin.clearChat(); setDraft(''); } catch (x) { showError('Erro', x); }
      })();
    });

  const runSync = async () => {
    setSyncMsg(null);
    try {
      const data = await sync.mutateAsync();
      qc.setQueryData(getGetFinanceSnapshotQueryKey(), data);
      await fin.setImported(scope, data);
      tap('success');
      setSyncMsg({ tone: 'info', text: `Importação concluída: ${data.accounts.length} contas, ${data.transactions.length} movimentações, ${data.investments.length} investimentos.` });
    } catch (e) {
      tap('warning');
      setSyncMsg({ tone: 'danger', text: describeApiError(e) });
    }
  };

  const exportData = async () => {
    const json = fin.exportJSON();
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(json);
        window.alert('JSON copiado para a área de transferência.');
      } else {
        await Share.share({ message: json, title: 'Exportação de dados financeiros' });
      }
    } catch (x) { showError('Não foi possível exportar', x); }
  };

  const st0 = status.data;
  const flag = (v: boolean | undefined) => (v ? 'configurado' : 'não configurado');

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: 20, paddingBottom: 80 }} bottomOffset={40}>
        {fin.persistError ? <Notice tone="danger" title="Falha ao salvar" body={fin.persistError} /> : null}

        <SectionTitle title="Servidor privado" />
        <Card>
          <Field testID="origin-input" label="Endereço HTTPS da sua VPS" value={draft} onChangeText={setDraft} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder={DEFAULT_ORIGIN ?? 'https://financas.seudominio.com'} error={originErr} hint="Somente a origem: sem usuário, senha, caminho ou parâmetros." />
          <Button testID="origin-save" label="Salvar endereço" icon="check" onPress={saveOrigin} />
          {fin.store.settings.serverOrigin ? <Button label="Voltar ao padrão" variant="ghost" onPress={resetOrigin} style={{ marginTop: 8 }} /> : null}
          <Text style={[st.small, { color: c.mutedForeground }]}>Em uso: {origin ?? 'nenhum'}</Text>
        </Card>

        <SectionTitle title="Status do serviço" action={origin ? 'Testar' : undefined} onAction={() => void status.refetch()} />
        <Card>
          {!origin ? (
            <Text style={[st.body, { color: c.mutedForeground }]}>Defina um endereço para testar.</Text>
          ) : status.isLoading || status.isRefetching ? (
            <View style={{ gap: 10 }}><Skeleton width="60%" /><Skeleton /><Skeleton width="80%" /></View>
          ) : status.isError ? (
            <Notice tone="danger" title="Serviço inacessível" body={describeApiError(status.error)} actionLabel="Tentar de novo" onAction={() => void status.refetch()} />
          ) : st0 ? (
            <>
              <Row label="Serviço" value={st0.service} />
              <Row label="Proprietário" value={flag(st0.ownerConfigured)} tone={st0.ownerConfigured ? 'income' : 'warning'} />
              <Row label="Pluggy" value={flag(st0.pluggyConfigured)} tone={st0.pluggyConfigured ? 'income' : 'warning'} />
              <Row label="ChatGPT OAuth" value={flag(st0.oauthConfigured)} tone={st0.oauthConfigured ? 'income' : 'warning'} />
              <Row label="Modelo" value={flag(st0.modelConfigured)} tone={st0.modelConfigured ? 'income' : 'warning'} />
              <Row label="Última importação" value={st0.lastSyncAt ? relativeTime(st0.lastSyncAt) : 'nunca'} />
              <Text style={[st.small, { color: c.mutedForeground }]}>"Configurado" indica apenas que o servidor tem as variáveis definidas, não que credenciais ou consentimentos foram validados.</Text>
            </>
          ) : null}
        </Card>

        <SectionTitle title="Conta" />
        <Card>
          {!auth.available ? (
            <Text style={[st.body, { color: c.mutedForeground }]}>Login indisponível nesta versão do app (chave do Clerk ausente).</Text>
          ) : !auth.loaded ? (
            <Skeleton />
          ) : auth.signedIn ? (
            <>
              <Row label="E-mail" value={auth.email ?? '—'} />
              <Row label="ID de usuário" value={auth.userId ?? '—'} />
              <Text style={[st.small, { color: c.mutedForeground }]}>Configure este ID como OWNER_CLERK_USER_ID no servidor. Só essa conta recebe dados.</Text>
              <Button testID="sign-out" label="Sair" icon="log-out" variant="secondary" style={{ marginTop: 12 }} onPress={() => confirmAction('Sair da conta?', 'Dados importados e a conversa com o agente serão removidos deste aparelho. Registros locais permanecem.', 'Sair', () => {
                auth.signOut().catch((x) => showError('Erro ao sair', x));
              })} />
            </>
          ) : (
            <>
              <Text style={[st.body, { color: c.mutedForeground }]}>Entre para importar dados reais do seu servidor e usar o agente. O app funciona sem login no modo local.</Text>
              <Button testID="open-auth" label="Entrar ou criar conta" icon="log-in" style={{ marginTop: 12 }} onPress={() => router.push('/auth')} />
            </>
          )}
        </Card>

        {auth.signedIn && origin ? (
          <>
            <SectionTitle title="Dados importados" />
            <Card>
              {snapshot.isLoading ? <Skeleton /> : snapshot.isError ? (
                <Notice tone="danger" title="Sem acesso ao retrato" body={describeApiError(snapshot.error)} actionLabel="Tentar de novo" onAction={() => void snapshot.refetch()} />
              ) : snapshot.data ? (
                <>
                  <Row label="Contas" value={String(snapshot.data.accounts.length)} />
                  <Row label="Movimentações" value={String(snapshot.data.transactions.length)} />
                  <Row label="Investimentos" value={String(snapshot.data.investments.length)} />
                  <Row label="Atualizado" value={snapshot.data.lastSyncAt ? relativeTime(snapshot.data.lastSyncAt) : 'nunca'} />
                  {snapshot.data.warnings.map((w, i) => <Notice key={i} tone="warning" title="Aviso do servidor" body={w} />)}
                </>
              ) : null}
              <Button testID="sync" label="Importar agora" icon="refresh-cw" loading={sync.isPending} onPress={() => void runSync()} style={{ marginTop: 12 }} />
              {syncMsg ? <View style={{ marginTop: 10 }}><Notice tone={syncMsg.tone} title={syncMsg.tone === 'danger' ? 'Importação falhou' : 'Importado'} body={syncMsg.text} /></View> : null}
              <Text style={[st.small, { color: c.mutedForeground }]}>Importa itens já conectados na Pluggy pelo servidor. Conectar novos bancos ainda não é feito pelo app.</Text>
            </Card>
          </>
        ) : null}

        <SectionTitle title="Como configurar" />
        <Card tone="muted">
          {[
            'Publique a API na sua VPS com HTTPS (veja docs/VPS.md).',
            'Entre no app e copie seu ID de usuário para OWNER_CLERK_USER_ID.',
            'Defina as credenciais Pluggy e conecte itens pelo servidor.',
            'Faça o login ChatGPT OAuth no servidor para habilitar o agente.',
            'Volte aqui, teste o status e importe.',
          ].map((t, i) => (
            <View key={i} style={st.step}>
              <Text style={[st.stepN, { color: c.primary }]}>{String(i + 1).padStart(2, '0')}</Text>
              <Text style={[st.body, { color: c.foreground, flex: 1 }]}>{t}</Text>
            </View>
          ))}
        </Card>

        <SectionTitle title="Privacidade e dados" />
        <Card>
          <View style={st.toggle}>
            <Feather name="eye-off" size={16} color={c.mutedForeground} />
            <Text style={[st.body, { color: c.foreground, flex: 1 }]}>Ocultar valores</Text>
            <Switch value={fin.store.settings.hideAmounts} onValueChange={(v) => void fin.setHideAmounts(v)} trackColor={{ true: c.primary, false: c.input }} thumbColor={c.foreground} />
          </View>
          <Text style={[st.small, { color: c.mutedForeground }]}>Registros manuais ficam só neste aparelho e não têm backup remoto. Exporte antes de desinstalar.</Text>
          <Button testID="export" label="Exportar JSON" icon="share" variant="secondary" style={{ marginTop: 12 }} onPress={() => void exportData()} />
          <Button testID="clear-local" label="Apagar dados locais" icon="trash-2" variant="danger" style={{ marginTop: 10 }} onPress={() => confirmAction('Apagar dados locais?', 'Movimentações, contas, orçamentos, metas, investimentos, assinaturas e conversa deste aparelho serão apagados. Isso não pode ser desfeito.', 'Apagar', () => {
            fin.clearLocal().then(() => tap('success')).catch((x) => showError('Erro', x));
          })} />
        </Card>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const st = StyleSheet.create({
  kv: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 7 },
  kvLabel: { fontFamily: F.medium, fontSize: 13 },
  kvValue: { fontFamily: F.semibold, fontSize: 13, flexShrink: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
  body: { fontFamily: F.regular, fontSize: 14, lineHeight: 20 },
  small: { fontFamily: F.regular, fontSize: 12, lineHeight: 17, marginTop: 10 },
  step: { flexDirection: 'row', gap: 12, paddingVertical: 6 },
  stepN: { fontFamily: F.bold, fontSize: 13, fontVariant: ['tabular-nums'], marginTop: 2 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
