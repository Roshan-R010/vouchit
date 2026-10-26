import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "./api-fetch";

export type Account = { id: string; role: "BRAND" | "CUSTOMER"; displayName: string; demoSessionId: string | null };
type AuthValue = { account: Account | null; loading: boolean; refresh: () => Promise<void>; signOut: () => Promise<void> };
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  async function refresh() {
    const response = await apiFetch("/api/auth/me", { cache: "no-store" });
    const data = await response.json();
    setAccount(data.account || null);
    setLoading(false);
  }
  useEffect(() => { void refresh().catch(() => setLoading(false)); }, []);
  async function signOut() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setAccount(null);
    localStorage.removeItem("vouch-demo-session");
  }
  return <AuthContext.Provider value={{ account, loading, refresh, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is missing");
  return value;
}
