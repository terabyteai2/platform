import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LocaleProvider } from "@/lib/locale-context";
import { Navbar } from "@/components/Navbar";

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
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t py-6 text-center text-xs" style={{ borderColor: "var(--hairline)", color: "var(--muted)", fontFamily: "JetBrains Mono, monospace" }}>
            VOICES · WEEKLY BANGLA DISCOURSE
          </footer>
        </LocaleProvider>
      </body>
    </html>
  );
}
