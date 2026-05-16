"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import bn from "@/locales/bn.json";
import en from "@/locales/en.json";

type Locale = "bn" | "en";
type Messages = typeof bn;

const LocaleContext = createContext<{
  locale: Locale;
  msgs: Messages;
  setLocale: (l: Locale) => void;
}>({
  locale: "bn",
  msgs: bn,
  setLocale: () => {},
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("bn");
  const msgs = locale === "bn" ? bn : (en as unknown as Messages);
  return (
    <LocaleContext.Provider value={{ locale, msgs, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
