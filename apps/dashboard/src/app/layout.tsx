import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "SessionForge",
  description: "Transform Claude Code sessions into publication-ready content",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=localStorage.getItem('sf-theme');var d=s==='dark'||(!s||s==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches;if(d){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}})();`,
          }}
        />
      </head>
      <body className="bg-sf-bg-primary text-sf-text-primary antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
