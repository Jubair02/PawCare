import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PawCare — Pet Care Platform",
  description: "Book vet & grooming appointments, manage pets, treatments, payments and reviews — all in one place.",
  keywords: ["pet care", "veterinary", "grooming", "appointments", "pets", "clinic"],
  authors: [{ name: "PawCare" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "PawCare — Pet Care Platform",
    description: "Book vet & grooming appointments, manage pets, treatments, payments and reviews.",
    siteName: "PawCare",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
