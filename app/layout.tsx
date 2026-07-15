import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Call Summarizer",
  description: "Upload a call recording, get an AI lead summary emailed to the team.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
