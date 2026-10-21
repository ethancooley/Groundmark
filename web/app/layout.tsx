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
