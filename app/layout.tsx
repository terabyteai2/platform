import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LocaleProvider } from "@/lib/locale-context";
import { UserProvider } from "@/lib/user-context";
import { Navbar } from "@/components/Navbar";
import { FloatingAvatar } from "@/components/Avatar";

export const metadata: Metadata = {
  title: "Voices — সাপ্তাহিক বাংলা মতামত",
  description: "প্রতি সপ্তাহে একটি বিষয়, লক্ষ মত — বাংলায়।",
  openGraph: {
    title: "Voices",
    description: "সাপ্তাহিক বাংলা মতামত প্ল্যাটফর্ম",
    locale: "bn_BD",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bn" className="h-full">
      <body className="min-h-full flex flex-col antialiased">
        <LocaleProvider>
          <UserProvider>
            <Navbar />
            <main className="flex-1">{children}</main>
            <footer
              className="mt-16 border-t"
              style={{ borderColor: "var(--hairline)" }}
            >
              <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded-[6px] text-white text-sm"
                    style={{ backgroundColor: "var(--ink)", fontFamily: "Newsreader, Georgia, serif", fontWeight: 500 }}
                  >
                    V
                  </span>
                  <span
                    className="voices-serif text-base"
                    style={{ color: "var(--ink)", fontWeight: 500, letterSpacing: "-0.01em" }}
                  >
                    Voices
                  </span>
                  <span
                    className="voices-quote text-sm"
                    style={{ color: "var(--muted)" }}
                  >
                    &mdash; এক প্রশ্ন, লক্ষ মত।
                  </span>
                </div>
                <span className="voices-eyebrow">
                  WEEKLY BANGLA DISCOURSE
                </span>
              </div>
            </footer>
            <FloatingAvatar />
          </UserProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
