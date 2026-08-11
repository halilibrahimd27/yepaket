import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://yepaket.app"),
  title: "YePaket — İyi yemek çöpe gitmesin",
  description:
    "Mahallendeki kafe, fırın ve marketlerin gün sonu sürpriz paketlerini kurtar; bütçene ve gezegene iyi bak.",
  icons: {
    icon: "/images/yep-logo.png",
    shortcut: "/images/yep-logo.png",
    apple: "/images/yep-logo.png",
  },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "YePaket",
    title: "YePaket — İyi yemek çöpe gitmesin",
    description: "Mahallendeki sürpriz paketleri kurtar; bütçene ve gezegene iyi bak.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "YePaket — İyi yemek çöpe gitmesin" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "YePaket — İyi yemek çöpe gitmesin",
    description: "Mahallendeki sürpriz paketleri kurtar; bütçene ve gezegene iyi bak.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" className="scroll-smooth">
      <body className={`${manrope.variable} antialiased`}>{children}</body>
    </html>
  );
}
