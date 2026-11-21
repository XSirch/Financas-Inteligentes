import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/context/auth';
import { FinanceProvider } from '@/context/finance';
import { SessionGuard } from '@/lib/ledger';
import colors from '@/constants/colors';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const c = colors.dark;
  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Voltar',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: c.background },
        headerTintColor: c.foreground,
        headerTitleStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 17 },
        contentStyle: { backgroundColor: c.background },
        navigationBarColor: c.background,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="transaction" options={{ title: 'Movimentação', presentation: 'modal' }} />
      <Stack.Screen name="budget" options={{ title: 'Orçamento', presentation: 'modal' }} />
      <Stack.Screen name="goal" options={{ title: 'Meta', presentation: 'modal' }} />
      <Stack.Screen name="holding" options={{ title: 'Investimento', presentation: 'modal' }} />
      <Stack.Screen name="account" options={{ title: 'Conta ou cartão', presentation: 'modal' }} />
      <Stack.Screen name="settings" options={{ title: 'Ajustes e conexões' }} />
      <Stack.Screen name="subscription" options={{ title: 'Assinatura', presentation: 'modal' }} />
      <Stack.Screen name="auth" options={{ title: 'Entrar', presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <FinanceProvider>
              <SessionGuard />
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <StatusBar style="light" />
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </FinanceProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
