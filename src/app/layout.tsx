import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "./providers";

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
  manifest: "/manifest.webmanifest",
  applicationName: "PawCare",
  appleWebApp: {
    capable: true,
    title: "PawCare",
    statusBarStyle: "default",
  },
  icons: {
    // SVG first for crisp tabs; the PNG is the fallback for anything that
    // ignores SVG favicons (older Safari, most link crawlers).
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "PawCare — Pet Care Platform",
    description: "Book vet & grooming appointments, manage pets, treatments, payments and reviews.",
    siteName: "PawCare",
    type: "website",
  },
};

export const viewport: Viewport = {
  // Tints the browser chrome on mobile; follows the theme the user picked.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#059669" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1f18" },
  ],
  colorScheme: "light dark",
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
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
