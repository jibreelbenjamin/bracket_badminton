import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import NavigationProgress from "@/components/NavigationProgress";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "Bracket Badminton",
  description: "Aplikasi pengelola bagan turnamen badminton",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex flex-col min-h-screen">
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <main className="flex-1">{children}</main>
        <footer className="text-center py-4 text-sm text-ink-300 border-t border-court-200/50">
          <p>
            &copy; {new Date().getFullYear()} Jibreel Benjamin
            {process.env.NEXT_PUBLIC_APP_VERSION && (
              <> &mdash; v{process.env.NEXT_PUBLIC_APP_VERSION}</>
            )}
          </p>
        </footer>
        <Toaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
