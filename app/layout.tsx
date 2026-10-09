import type { Metadata } from "next";
import { AppearanceProvider } from "@/components/appearance-provider";
import { APPEARANCE_BOOTSTRAP_SCRIPT } from "@/lib/appearance";
import { SIDEBAR_BOOTSTRAP_SCRIPT } from "@/lib/sidebar-preference";
import "./globals.css";
import "./dashboard-presentation.css";
import "./athletic-theme.css";
import { Barlow_Condensed, Inter } from "next/font/google";

// Modern Athletic type: self-hosted at build time, so browsers make no requests to Google.
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-barlow", display: "swap" });
const ui = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
export const metadata: Metadata = {
  title: { default: "PACU Baseball Performance", template: "%s | PACU Baseball Performance" },
  description: "A private baseball roster and performance workspace. Independently owned by Trevor Kazahaya.",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning className={`${display.variable} ${ui.variable}`}><head><script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOTSTRAP_SCRIPT }} /><script dangerouslySetInnerHTML={{ __html: SIDEBAR_BOOTSTRAP_SCRIPT }} /></head><body><AppearanceProvider>{children}</AppearanceProvider></body></html>;
}
