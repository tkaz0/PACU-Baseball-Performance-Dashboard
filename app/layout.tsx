import type { Metadata } from "next";
import { AppearanceProvider } from "@/components/appearance-provider";
import { APPEARANCE_BOOTSTRAP_SCRIPT } from "@/lib/appearance";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "PACU Baseball Performance", template: "%s | PACU Baseball Performance" },
  description: "A private baseball roster and performance workspace. Independently owned by Trevor Kazahaya.",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOTSTRAP_SCRIPT }} /></head><body><AppearanceProvider>{children}</AppearanceProvider></body></html>;
}
