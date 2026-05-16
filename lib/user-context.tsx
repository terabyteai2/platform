"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";

export interface CurrentUser {
  id: string;
  displayName: string | null;
  isAnon: boolean;
}

interface UserContextValue {
  user: CurrentUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  updateName: (displayName: string | null) => Promise<{ ok: true } | { ok: false; error: string }>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/me", { cache: "no-store" });
      if (!r.ok) {
        setUser(null);
        return;
      }
      const d = await r.json();
      setUser(d.user ?? null);
    } catch {
      // Network error — keep whatever we already have.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateName = useCallback<UserContextValue["updateName"]>(
    async (displayName) => {
      const r = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        return { ok: false, error: d.error ?? `HTTP ${r.status}` };
      }
      if (d.user) setUser(d.user);
      return { ok: true };
    },
    []
  );

  return (
    <UserContext.Provider value={{ user, loading, refresh, updateName }}>
      {children}
    </UserContext.Provider>
  );
}

export function useCurrentUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useCurrentUser must be used inside <UserProvider>");
  return ctx;
}

export function initialsFor(name: string | null | undefined): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
