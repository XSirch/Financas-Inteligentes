import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { ClerkProvider, useAuth, useUser } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { setAuthTokenGetter } from '@workspace/api-client-react';

export type AuthState = {
  available: boolean;
  loaded: boolean;
  signedIn: boolean;
  userId: string | null;
  email: string | null;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

const unavailable: AuthState = {
  available: false,
  loaded: true,
  signedIn: false,
  userId: null,
  email: null,
  getToken: async () => null,
  signOut: async () => {},
};

const AuthCtx = createContext<AuthState>(unavailable);

export const CLERK_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function ClerkBridge({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken, signOut } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    if (isSignedIn) {
      setAuthTokenGetter(() => getToken());
    } else {
      setAuthTokenGetter(null);
    }
    return () => setAuthTokenGetter(null);
  }, [isSignedIn, getToken]);

  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const value = useMemo<AuthState>(
    () => ({
      available: true,
      loaded: !!isLoaded,
      signedIn: !!isSignedIn,
      userId: isSignedIn ? userId ?? null : null,
      email: isSignedIn ? email : null,
      getToken: async () => (isSignedIn ? (await getToken()) ?? null : null),
      signOut: async () => {
        setAuthTokenGetter(null);
        await signOut();
      },
    }),
    [isLoaded, isSignedIn, userId, email, getToken, signOut],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!CLERK_KEY) {
    return <AuthCtx.Provider value={unavailable}>{children}</AuthCtx.Provider>;
  }
  return (
    <ClerkProvider
      publishableKey={CLERK_KEY}
      tokenCache={tokenCache}
      proxyUrl={process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined}
    >
      <ClerkBridge>{children}</ClerkBridge>
    </ClerkProvider>
  );
}

export function useAuthState() {
  return useContext(AuthCtx);
}
