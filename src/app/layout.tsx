import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GradeBuddy — NIE Grade Calculator",
  description:
    "Calculate your required SEE marks, simulate GPAs, and plan your semester grades. Built for NIE students.",
  keywords: ["NIE", "grade calculator", "GPA", "SGPA", "CIE", "SEE", "Contineo"],
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
