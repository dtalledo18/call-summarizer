import type { Metadata } from "next";
import "./globals.css";
import Header from "@/app/components/Header";

export const metadata: Metadata = {
  title: "Call Summarizer & Notion Sync",
  description: "Gestión de llamadas y sincronización masiva con Notion.",
};

export default function RootLayout({
                                     children,
                                   }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
      <Header />
      <main className="p-6">{children}</main>
      </body>
      </html>
  );
}