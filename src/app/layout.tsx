import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { CursorGlow } from "@/components/ui/cursor-glow";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shipticle — AI Editorial Pipeline",
  description: "Weekly AI-powered article pipeline from idea to publish.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-mono">
        <AuthProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </AuthProvider>
        <Toaster />
        <CursorGlow />
      </body>
    </html>
  );
}
