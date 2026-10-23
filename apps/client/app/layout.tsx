import type { Metadata } from "next";
import { Figtree, IBM_Plex_Mono } from "next/font/google";
import "@/app/globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-figtree",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: "500",
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "KuKi Evidence Dashboard",
  description:
    "Upload sustainability documents, inspect extracted facts with their sources, and ask questions with evidence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${figtree.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
