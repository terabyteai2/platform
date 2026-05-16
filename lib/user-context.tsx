"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";

export interface CurrentUser {
  id: string;
  displayName: string | null;
  isAnon: boolean;
}

export interface NamePrompt {
  message: string;
}

interface UserContextValue {
  user: CurrentUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  updateName: (
    displayName: string | null
  ) => Promise<{ ok: true } | { ok: false; error: string }>;

  // ── Floating avatar prompt API ─────────────────────────────────────────
  /** Currently-active prompt request, or null if no prompt is open. */
  prompt: NamePrompt | null;
  /**
   * Open the floating avatar with a custom prompt and wait for the user to
   * either save a name (resolves true) or cancel (resolves false). If the
   * user already has a displayName, resolves true immediately without
   * showing the prompt.
   */
  requireName: (message: string) => Promise<boolean>;
  /** Internal — called by the floating avatar once the prompt is resolved. */
  resolvePrompt: (ok: boolean) => void;
  /** Open the avatar editor without a forced prompt — just to edit. */
  openEditor: () => void;
  /** Avatar editor open/closed state. */
  editorOpen: boolean;
  setEditorOpen: (open: boolean) => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState<NamePrompt | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  // Resolver for the active requireName() promise.
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

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
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
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

  const resolvePrompt = useCallback((ok: boolean) => {
    const fn = resolverRef.current;
    resolverRef.current = null;
    setPrompt(null);
    setEditorOpen(false);
    if (fn) fn(ok);
  }, []);

  const requireName = useCallback<UserContextValue["requireName"]>(
    (message) =>
      new Promise<boolean>((resolve) => {
        // Already have a name → no prompt, just continue.
        if (user?.displayName && user.displayName.trim()) {
          resolve(true);
          return;
        }
        // If a previous prompt is somehow still open, cancel it.
        if (resolverRef.current) {
          try { resolverRef.current(false); } catch {}
        }
        resolverRef.current = resolve;
        setPrompt({ message });
        setEditorOpen(true);
      }),
    [user]
  );

  const openEditor = useCallback(() => {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
    setPrompt(null);
    setEditorOpen(true);
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        refresh,
        updateName,
        prompt,
        requireName,
        resolvePrompt,
        openEditor,
        editorOpen,
        setEditorOpen,
      }}
    >
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
