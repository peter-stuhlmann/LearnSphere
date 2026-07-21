import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser } from "@elearning/api-contracts/mobile/v1/auth";
import * as authApi from "../api/auth";

/** Auth-Zustand der App: Session-Restore beim Start, Login/Logout. */

interface AuthContextValue {
  /** null = nicht angemeldet; undefined = Restore läuft noch */
  user: AuthUser | null | undefined;
  signIn: (input: {
    email: string;
    password: string;
    totp?: string;
  }) => Promise<authApi.LoginResult>;
  signInWithIdToken: (
    provider: "google" | "linkedin",
    idToken: string
  ) => Promise<authApi.LoginResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    authApi.restoreSession().then((restored) => {
      if (active) setUser(restored);
    });
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback<AuthContextValue["signIn"]>(async (input) => {
    const result = await authApi.login(input);
    if (result.status === "ok") setUser(result.user);
    return result;
  }, []);

  const signInWithIdToken = useCallback<AuthContextValue["signInWithIdToken"]>(
    async (provider, idToken) => {
      const result = await authApi.oauthLogin(provider, idToken);
      if (result.status === "ok") setUser(result.user);
      return result;
    },
    []
  );

  const signOut = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, signIn, signInWithIdToken, signOut }),
    [user, signIn, signInWithIdToken, signOut]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth muss innerhalb von <AuthProvider> genutzt werden");
  }
  return context;
}
