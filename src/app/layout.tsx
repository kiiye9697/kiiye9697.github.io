import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kiiye9697 | Rendering / PCG TA",
  description:
    "Kiiye9697 — Rendering / PCG TA focused on technical art practice, rendering workflows, and personal writing.",
  keywords: ["Kiiye9697", "Rendering", "PCG", "Technical Art", "TA", "Zhihu", "Portfolio"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
