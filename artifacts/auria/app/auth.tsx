import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth, useSignIn, useSignUp, useSSO } from '@clerk/expo';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useColors } from '@/hooks/useColors';
import { CLERK_KEY } from '@/context/auth';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Button, EmptyState, F, Field, Notice, Segmented, tap } from '@/components/ui';

WebBrowser.maybeCompleteAuthSession();

function errText(e: unknown): string {
  const x = e as { errors?: { longMessage?: string; message?: string }[]; longMessage?: string; message?: string } | null;
  return x?.errors?.[0]?.longMessage ?? x?.errors?.[0]?.message ?? x?.longMessage ?? x?.message ?? 'Não foi possível concluir. Tente novamente.';
}

const done = () => { tap('success'); if (router.canGoBack()) router.back(); else router.replace('/'); };

function SignInForm() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const busy = fetchStatus === 'fetching';

  const finalize = async () => {
    await signIn.finalize({ navigate: () => done() });
  };
  const submit = async () => {
    setMsg(null);
    const { error } = await signIn.password({ emailAddress: email.trim(), password });
    if (error) return setMsg(errText(error));
    if (signIn.status === 'complete') return finalize();
    if (signIn.status === 'needs_client_trust' || signIn.status === 'needs_second_factor') {
      const f = signIn.supportedSecondFactors.find((x) => x.strategy === 'email_code');
      if (f) await signIn.mfa.sendEmailCode();
      else setMsg('Sua conta exige um segundo fator que este app ainda não suporta.');
      return;
    }
    setMsg('Login não concluído. Verifique os dados.');
  };
  const verify = async () => {
    setMsg(null);
    const { error } = await signIn.mfa.verifyEmailCode({ code: code.trim() });
    if (error) return setMsg(errText(error));
    if (signIn.status === 'complete') return finalize();
    setMsg('Código não aceito.');
  };

  if (signIn.status === 'needs_client_trust' || signIn.status === 'needs_second_factor') {
    return (
      <>
        <Text style={useTitle()}>Confirme pelo e-mail</Text>
        <Field testID="signin-code" label="Código recebido" value={code} onChangeText={setCode} keyboardType="number-pad" error={errors.fields.code?.message ?? null} />
        {msg ? <Notice tone="danger" title="Atenção" body={msg} /> : null}
        <Button label="Verificar" icon="check" loading={busy} onPress={() => void verify()} style={{ marginTop: 12 }} />
        <Button label="Reenviar código" variant="ghost" onPress={() => void signIn.mfa.sendEmailCode()} style={{ marginTop: 8 }} />
        <Button label="Recomeçar" variant="ghost" onPress={() => void signIn.reset()} style={{ marginTop: 8 }} />
      </>
    );
  }
  return (
    <>
      <Field testID="signin-email" label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" error={errors.fields.identifier?.message ?? null} />
      <Field testID="signin-password" label="Senha" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" error={errors.fields.password?.message ?? null} />
      {msg ? <Notice tone="danger" title="Não foi possível entrar" body={msg} /> : null}
      <Button testID="signin-submit" label="Entrar" icon="log-in" loading={busy} disabled={!email || !password} onPress={() => void submit()} style={{ marginTop: 12 }} />
    </>
  );
}

function SignUpForm() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const busy = fetchStatus === 'fetching';

  const submit = async () => {
    setMsg(null);
    const { error } = await signUp.password({ emailAddress: email.trim(), password });
    if (error) return setMsg(errText(error));
    const r = await signUp.verifications.sendEmailCode();
    if (r?.error) setMsg(errText(r.error));
  };
  const verify = async () => {
    setMsg(null);
    const { error } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
    if (error) return setMsg(errText(error));
    if (signUp.status === 'complete') await signUp.finalize({ navigate: () => done() });
    else setMsg('Cadastro ainda incompleto. Verifique o código.');
  };

  const verifying = signUp.status === 'missing_requirements' && signUp.unverifiedFields.includes('email_address') && signUp.missingFields.length === 0;
  return (
    <>
      {verifying ? (
        <>
          <Text style={useTitle()}>Enviamos um código para {email || 'seu e-mail'}</Text>
          <Field testID="signup-code" label="Código" value={code} onChangeText={setCode} keyboardType="number-pad" error={errors.fields.code?.message ?? null} />
          {msg ? <Notice tone="danger" title="Atenção" body={msg} /> : null}
          <Button testID="signup-verify" label="Verificar e criar conta" icon="check" loading={busy} onPress={() => void verify()} style={{ marginTop: 12 }} />
          <Button label="Reenviar código" variant="ghost" onPress={() => void signUp.verifications.sendEmailCode()} style={{ marginTop: 8 }} />
        </>
      ) : (
        <>
          <Field testID="signup-email" label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" error={errors.fields.emailAddress?.message ?? null} />
          <Field testID="signup-password" label="Senha" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={errors.fields.password?.message ?? null} />
          {msg ? <Notice tone="danger" title="Não foi possível criar" body={msg} /> : null}
          <Button testID="signup-submit" label="Criar conta" icon="user-plus" loading={busy} disabled={!email || !password} onPress={() => void submit()} style={{ marginTop: 12 }} />
        </>
      )}
      <View nativeID="clerk-captcha" />
    </>
  );
}

function GoogleButton() {
  const { startSSOFlow } = useSSO();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);
  const go = useCallback(async () => {
    setBusy(true); setMsg(null);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({ strategy: 'oauth_google', redirectUrl: AuthSession.makeRedirectUri() });
      if (createdSessionId && setActive) await setActive({ session: createdSessionId, navigate: async () => done() });
      else setMsg('Login com Google não foi concluído.');
    } catch (e) { setMsg(errText(e)); } finally { setBusy(false); }
  }, [startSSOFlow]);
  return (
    <>
      <Button testID="google" label="Continuar com Google" icon="chrome" variant="secondary" loading={busy} onPress={() => void go()} />
      {msg ? <View style={{ marginTop: 10 }}><Notice tone="danger" title="Google" body={msg} /></View> : null}
    </>
  );
}

function useTitle() {
  const c = useColors();
  return [st.stepTitle, { color: c.foreground }];
}

function ClerkAuth() {
  const c = useColors();
  const { isSignedIn } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  if (isSignedIn) {
    return <EmptyState icon="check-circle" title="Você já está conectado" body="Gerencie a sessão em Ajustes." actionLabel="Ir para Ajustes" onAction={() => router.replace('/settings')} />;
  }
  return (
    <>
      <Text style={[st.kicker, { color: c.primary }]}>Conta pessoal</Text>
      <Text style={[st.h1, { color: c.foreground }]}>Conecte seu servidor privado</Text>
      <Text style={[st.lead, { color: c.mutedForeground }]}>O login só libera dados se esta conta for a proprietária configurada na sua VPS. Sem login, o modo local continua funcionando.</Text>
      <GoogleButton />
      <View style={st.divider}>
        <View style={[st.line, { backgroundColor: c.border }]} />
        <Text style={[st.or, { color: c.mutedForeground }]}>ou com e-mail</Text>
        <View style={[st.line, { backgroundColor: c.border }]} />
      </View>
      <Segmented options={[{ value: 'in', label: 'Entrar' }, { value: 'up', label: 'Criar conta' }]} value={mode} onChange={setMode} />
      <View style={{ height: 18 }} />
      {mode === 'in' ? <SignInForm /> : <SignUpForm />}
    </>
  );
}

export default function AuthScreen() {
  const c = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: 20, paddingBottom: 60 }} bottomOffset={40} keyboardShouldPersistTaps="handled">
        {CLERK_KEY ? <ClerkAuth /> : (
          <EmptyState icon="lock" title="Login indisponível" body="Esta versão do app foi gerada sem a chave pública do Clerk. O modo local continua disponível." />
        )}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const st = StyleSheet.create({
  kicker: { fontFamily: F.semibold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 8 },
  h1: { fontFamily: F.bold, fontSize: 26, letterSpacing: -0.8, marginTop: 6 },
  lead: { fontFamily: F.regular, fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 20 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 20 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  or: { fontFamily: F.medium, fontSize: 12 },
  stepTitle: { fontFamily: F.semibold, fontSize: 17, marginBottom: 14 },
});
