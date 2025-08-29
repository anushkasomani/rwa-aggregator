import type { Metadata } from "next";
import type { Metadata } from "next";
import "./globals.css";
import { spaceGrotesk, inter } from "./fonts";
import { ToastProvider } from "@/components/toast/ToastProvider";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import WalletModal from "@/components/wallet/WalletModal";
import { AppStateProvider } from "@/components/state/AppStateProvider";

export const metadata: Metadata = {
  title: "PromptFi — Talk-to-Portfolio Vaults",
  description: "Turn prompts into guarded, non-custodial async vaults (ERC-7540) with Safe + Zodiac.",
  openGraph: {
    title: "PromptFi — Talk-to-Portfolio Vaults",
    description: "Turn prompts into guarded, non-custodial async vaults (ERC-7540) with Safe + Zodiac.",
    type: "website",
    url: "https://promptfi.example",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${inter.variable} antialiased`}>
        <ToastProvider>
          <WalletProvider>
            <AppStateProvider>
              <div className="min-h-dvh">{children}</div>
              <WalletModal />
            </AppStateProvider>
          </WalletProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
