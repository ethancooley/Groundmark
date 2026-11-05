import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  alternates: { canonical: "/" },
  title: `${SITE.name}: read the sources behind Google's AI Overviews`,
  description: SITE.description,
  openGraph: {
    title: SITE.name,
    description: SITE.tagline,
    type: "website",
    url: SITE.url,
    siteName: SITE.name,
  },
  // A large image card on X; it uses the same image as the Open Graph preview.
  twitter: {
    card: "summary_large_image",
    title: SITE.name,
    description: SITE.tagline,
  },
};

export const viewport: Viewport = {
  themeColor: "#f5f7fa",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-paper text-ink">{children}</body>
    </html>
  );
}
