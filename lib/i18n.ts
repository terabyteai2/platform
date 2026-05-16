import bn from "@/locales/bn.json";
import en from "@/locales/en.json";

export type Locale = "bn" | "en";
export type Messages = typeof bn;

const messages: Record<Locale, Messages> = { bn, en };

export function getMessages(locale: Locale): Messages {
  return messages[locale] ?? messages.bn;
}

// Dot-notation accessor
export function t(msgs: Messages, key: string): string {
  const parts = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let val: any = msgs;
  for (const part of parts) {
    val = val?.[part];
  }
  return typeof val === "string" ? val : key;
}
