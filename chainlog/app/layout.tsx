import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "ChainLog — Industrial Integrity Dashboard",
  description: "Real-time machinery telemetry with on-chain tamper prevention on Celo Sepolia",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}