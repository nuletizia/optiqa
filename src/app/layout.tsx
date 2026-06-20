import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { DashboardHeader } from "@/components/DashboardHeader";
import { auth } from "@/auth";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OptiQA - Optimal Quality Assessment",
  description: "Advanced image quality assessment and comparison tool",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth();
  const childrenString = children?.toString() || "";
  const isAuthPage = childrenString.includes("auth");

  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {!isAuthPage && <DashboardHeader />}
          {children}
        </Providers>
      </body>
    </html>
  );
}
