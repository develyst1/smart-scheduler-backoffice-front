import type { Metadata } from "next";
import { Noto_Sans_Thai, IBM_Plex_Mono } from "next/font/google";
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import { AppProviders } from "@/context/AppProviders";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-noto-sans-thai",
});

// Monospaced figures give the money read like a ledger/terminal — a deliberate
// finance-cockpit character, used for every amount via the `.font-num` utility.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Smart Backoffice",
  description: "ระบบหลังบ้าน — สต๊อก, Wallet, Payroll และรายงาน",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" {...mantineHtmlProps} className={`${notoSansThai.variable} ${plexMono.variable}`}>
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
      </head>
      <body className="min-h-screen font-sans text-foreground">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
