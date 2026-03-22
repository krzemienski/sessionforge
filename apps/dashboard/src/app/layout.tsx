import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "SessionForge",
  description: "Transform Claude Code sessions into publication-ready content",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head />
      <body className="bg-sf-bg-primary text-sf-text-primary antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
