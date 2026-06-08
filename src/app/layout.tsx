import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pursuit CRM",
  description: "AI-powered relationship manager for ambitious founders",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="h-full bg-[#faf9f5] font-sans">
        <div className="flex h-full">
          <Sidebar />
          <main className="flex-1 ml-[4.75rem] flex flex-col min-h-screen overflow-hidden">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
