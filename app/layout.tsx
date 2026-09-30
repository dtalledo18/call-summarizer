import type { Metadata } from "next";
import "./globals.css";
import Header from "@/app/components/Header";

export const metadata: Metadata = {
    title: {
        default: "Call & Leads Summarizer",
        template: "%s · Call & Leads Summarizer",
    },
    description: "Gestión de llamadas, sync de leads con Notion, y dashboard de leads de JobNimbus.",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
        <body className="bg-[#111111] text-gray-100 min-h-screen">
        <Header />
        <main className="p-6">{children}</main>
        </body>
        </html>
    );
}