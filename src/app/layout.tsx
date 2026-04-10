import type { Metadata } from "next";
import { profile, skills } from "@/lib/resume";
import "./globals.css";

export const metadata: Metadata = {
  title: `${profile.name} | ${profile.title}`,
  description: profile.summary,
  keywords: [profile.name, profile.title, ...skills],
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
